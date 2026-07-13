import test from "node:test";
import assert from "node:assert/strict";

import { toSafeJsonLdString } from "./json-ld";

test("serializes a simple object to valid JSON", () => {
  const result = toSafeJsonLdString({ name: "Acme", value: 42 });
  assert.equal(result, '{"name":"Acme","value":42}');
});

test("escapes < to \\u003c to prevent </script> breakout (audit 1.3)", () => {
  const malicious = {
    name: "Evil</script><img src=x onerror=alert(1)>",
  };
  const result = toSafeJsonLdString(malicious);
  // The </script> substring must never appear literally in the output
  assert.ok(!result.includes("</script>"), "output must not contain literal </script>");
  assert.ok(!result.includes("<img"), "output must not contain literal <");
  assert.ok(result.includes("\\u003c"), "output must escape < to \\u003c");
});

test("escapes > to \\u003e (defense-in-depth)", () => {
  const result = toSafeJsonLdString({ name: "a>b" });
  assert.ok(result.includes("\\u003e"), "output must escape > to \\u003e");
  assert.ok(!result.includes("a>b"), "raw > must not survive");
});

test("escapes U+2028 and U+2029 line/paragraph separators", () => {
  const result = toSafeJsonLdString({ name: "line\u2028para\u2029end" });
  assert.ok(result.includes("\\u2028"), "U+2028 must be escaped");
  assert.ok(result.includes("\\u2029"), "U+2029 must be escaped");
  assert.ok(!result.includes("\u2028"), "raw U+2028 must not survive");
  assert.ok(!result.includes("\u2029"), "raw U+2029 must not survive");
});

test("escaped output is still valid JSON with identical semantics", () => {
  const data = {
    "@type": "FAQPage",
    name: "Q&A with </script> and > symbols",
    items: [{ q: "Is <script> safe?", a: "Yes" }],
  };
  const escaped = toSafeJsonLdString(data);
  // The escaped string, when parsed back, must equal the original data
  // because \u003c etc. are valid JSON string escapes for the same chars.
  assert.deepEqual(JSON.parse(escaped), data);
});

test("handles arrays, nested objects, null, and numbers", () => {
  const data = {
    "@context": "https://schema.org",
    mainEntity: [
      { "@type": "Question", name: "Q1", acceptedAnswer: { text: "A1" } },
    ],
    count: 3,
    empty: null,
  };
  const result = toSafeJsonLdString(data);
  assert.deepEqual(JSON.parse(result), data);
});
