import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  GENERIC_SUBMIT_ERROR,
  isRedirectError,
  submitErrorMessage,
  type LeadSubmitOutcome,
} from "./lead-submit-result";

// A "use server" function that THROWS has its message replaced by a digest in
// production (the Vercel log showed `digest: '2322239309'`), so the page wrapper
// returns the failure instead, and the form shows what it returns.

test("a returned error message is shown as is", () => {
  const outcome: LeadSubmitOutcome = {
    error: "Failed to submit your request. Please try again.",
  };
  assert.equal(
    submitErrorMessage(outcome),
    "Failed to submit your request. Please try again.",
  );
});

test("no outcome at all (a redirect or a success) shows no error", () => {
  assert.equal(submitErrorMessage(undefined), null);
  assert.equal(submitErrorMessage(null), null);
  assert.equal(submitErrorMessage({}), null);
});

test("an empty or blank error falls back to the generic message", () => {
  assert.equal(submitErrorMessage({ error: "" }), GENERIC_SUBMIT_ERROR);
  assert.equal(submitErrorMessage({ error: "   " }), GENERIC_SUBMIT_ERROR);
});

test("a thrown error shows the generic message, never the thrown text", () => {
  assert.equal(
    submitErrorMessage(new Error("digest: 2322239309")),
    GENERIC_SUBMIT_ERROR,
  );
  assert.equal(submitErrorMessage("boom"), GENERIC_SUBMIT_ERROR);
});

test("a Next redirect error is recognised and a real failure is not", () => {
  const redirect = Object.assign(new Error("NEXT_REDIRECT"), {
    digest: "NEXT_REDIRECT;replace;/lead/success;307;",
  });
  assert.equal(isRedirectError(redirect), true);
  // The production digest of a thrown server-action error is not a redirect.
  assert.equal(isRedirectError({ digest: "2322239309" }), false);
  assert.equal(isRedirectError(new Error("boom")), false);
  assert.equal(isRedirectError(null), false);
  assert.equal(isRedirectError("NEXT_REDIRECT"), false);
});

test("a redirect error is not turned into a failure message", () => {
  // The forms rethrow it before calling submitErrorMessage.
  const forms = ["hvac", "plumbing", "electrical"].map((i) =>
    readFileSync(
      new URL(`../../components/${i}/${i}-lead-form.tsx`, import.meta.url),
      "utf8",
    ).replace(/\r\n/g, "\n"),
  );
  for (const form of forms) {
    const rethrow = form.indexOf("if (isRedirectError(err)) throw err;");
    const message = form.indexOf("setSubmitError(submitErrorMessage(err))");
    // indexOf is -1 when absent, and -1 < n is true, so require both to exist.
    assert.ok(rethrow > -1, "the form must rethrow a redirect error");
    assert.ok(message > -1, "the form must show a message for a failure");
    assert.ok(
      rethrow < message,
      "a redirect must be rethrown before a message is set",
    );
  }
});

// ---------------------------------------------------------------------------
// The three forms and pages
// ---------------------------------------------------------------------------

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8").replace(/\r\n/g, "\n");

for (const industry of ["hvac", "plumbing", "electrical"] as const) {
  test(`${industry} form shows a failed submit instead of only logging it`, () => {
    const form = read(`../../components/${industry}/${industry}-lead-form.tsx`);
    assert.match(form, /submitErrorMessage\(/);
    // The message is rendered by the shared shell (see the shell test below).
    assert.match(form, /submitError=\{submitError\}/);
    // The old behaviour: catch, log to the console, show nothing.
    assert.ok(
      !/catch \{\s*console\.error\("\[\w+LeadForm\] Submission error"\);\s*\}/.test(
        form,
      ),
      "the empty console-only catch must be gone",
    );
  });

  test(`${industry} page returns the failure instead of throwing it`, () => {
    // (see also the shell test below)
    const page = read(`../../app/${industry}/lead/page.tsx`);
    assert.ok(
      !/throw new Error\(result\.error/.test(page),
      "a thrown server-action error reaches the client as a digest",
    );
    assert.match(page, /return \{ error: result\.error/);
    assert.match(page, /redirect\("\/lead\/success"\)/);
  });
}

test("the shared form shell renders the message as an alert, only when set", () => {
  const shell = read("../../components/industry/lead-form-shell.tsx");
  assert.match(shell, /submitError\?: string \| null/);
  assert.match(shell, /\{submitError && \(/);
  assert.match(shell, /role="alert"/);
});
