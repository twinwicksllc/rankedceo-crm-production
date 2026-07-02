#!/usr/bin/env node
/**
 * QA Agent CLI
 *
 * Usage:
 *   npm run qa-agent -- --scenario scenarios/smoke.yaml
 *   npm run qa-agent -- --scenario scenarios/full_lifecycle.yaml --mode full
 *
 * Environment variables (see .env.qa.example):
 *   QA_BASE_URL              Base URL to test against
 *   QA_ADMIN_EMAIL           Admin account email
 *   QA_ADMIN_PASSWORD        Admin account password
 *   QA_CLIENT_REVIEW_TOKEN   Client reviewToken for the client persona
 *   SUPABASE_URL             Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY Supabase service role key
 *   RESEND_API_KEY           Resend API key (for email verification + critical halt emails)
 *   GITHUB_TOKEN             GitHub token (for Issue creation + restart gate)
 *   GITHUB_REPO              GitHub repo (default: twinwicksllc/rankedceo-crm-production)
 *   QA_RESTART_GATE          true|false override for critical-halt restart gate
 *   QA_BILLING_MOCK          Set to "true" to mock billing (overrides --mode)
 */

import { parseArgs } from "node:util";
import { randomBytes } from "node:crypto";
import { Orchestrator } from "./orchestrator/Orchestrator.js";
import type { RunConfig, RunMode } from "./types.js";

// ─── Parse args ───────────────────────────────────────────────────────────────

const { values } = parseArgs({
  options: {
    scenario: { type: "string" },
    mode: { type: "string", default: "smoke" },
    help: { type: "boolean", default: false },
  },
  strict: true,
});

if (values.help || !values.scenario) {
  console.log(`
  RankedCEO QA Agent

  Usage:
    npm run qa-agent -- --scenario <path> [--mode smoke|full]

  Options:
    --scenario  Path to YAML scenario file (required)
    --mode      Run mode: smoke (default) or full
    --help      Show this help

  Examples:
    npm run qa-agent -- --scenario scenarios/smoke.yaml
    npm run qa-agent -- --scenario scenarios/full_lifecycle.yaml --mode full
  `);
  process.exit(values.help ? 0 : 1);
}

// ─── Build RunConfig ──────────────────────────────────────────────────────────

const mode = (values.mode === "full" ? "full" : "smoke") as RunMode;
const billingMock = process.env.QA_BILLING_MOCK === "true" || mode === "smoke";
const emailTest = mode === "full" && process.env.QA_BILLING_MOCK !== "true";

const runId = `${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}_${randomBytes(4).toString("hex")}`;

const baseUrl = process.env.QA_BASE_URL;
if (!baseUrl) {
  console.error("❌ QA_BASE_URL is not set");
  process.exit(1);
}

const adminEmail = process.env.QA_ADMIN_EMAIL;
const adminPassword = process.env.QA_ADMIN_PASSWORD;
if (!adminEmail || !adminPassword) {
  console.error("❌ QA_ADMIN_EMAIL and QA_ADMIN_PASSWORD are required");
  process.exit(1);
}

const reviewToken = process.env.QA_CLIENT_REVIEW_TOKEN;
if (!reviewToken) {
  console.error("❌ QA_CLIENT_REVIEW_TOKEN is required");
  process.exit(1);
}

const config: RunConfig = {
  runId,
  mode,
  scenarioPath: values.scenario,
  baseUrl,
  adminCredentials: {
    type: "admin",
    email: adminEmail,
    password: adminPassword,
  },
  clientCredentials: {
    type: "client",
    reviewToken,
  },
  stripeTestMode: !billingMock,
  emailTestMode: emailTest,
};

// ─── Run ──────────────────────────────────────────────────────────────────────

const orchestrator = new Orchestrator(config);
const report = await orchestrator.run();

// Exit code reflects run status
const exitCode =
  report.status === "pass" || report.status === "pass_with_findings" ? 0 : 1;

process.exit(exitCode);
