// =============================================================================
// RankedCEO Website Builder — Onboarding Entry Page (Server Component)
// Reads auditId + tier from URL params, renders the client flow
// =============================================================================

import type { Metadata } from "next";
import { OnboardingFlow } from "./onboarding-flow";

export const metadata: Metadata = {
  title: "Get Started | RankedCEO",
  description: "Build your RankedCEO website in minutes.",
};

interface PageProps {
  searchParams: Promise<{ auditId?: string; audit_id?: string; tier?: string }>;
}

export default async function OnboardingPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams;
  const auditId =
    resolvedSearchParams.auditId ?? resolvedSearchParams.audit_id ?? null;
  const tier =
    (resolvedSearchParams.tier as "hosting" | "standard" | "premium") ??
    "standard";

  return <OnboardingFlow auditId={auditId} initialTier={tier} />;
}
