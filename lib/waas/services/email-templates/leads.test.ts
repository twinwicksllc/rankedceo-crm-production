import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { escapeHtml, tenantLeadReceived } from "./leads";
import { renderEmailTemplate } from "./index";

describe("tenantLeadReceived", () => {
  const hostile = {
    businessName: "Acme <b>Plumbing</b>",
    leadName: "Eve <script>alert(1)</script>",
    leadEmail: 'eve@example.com"><img src=x onerror=alert(1)>',
    leadPhone: "(512) 555-0142",
    leadMessage: "Hi <a href=\"http://evil\">click</a>\nsecond line",
    leadService: "Drain <i>cleaning</i>",
    leadPageUrl: "https://acme.com/?q=<x>",
  };

  it("escapes every visitor-supplied field", () => {
    const { html } = tenantLeadReceived(hostile);
    assert.doesNotMatch(html, /<script>alert/);
    assert.doesNotMatch(html, /<img src=x/);
    assert.doesNotMatch(html, /<a href="http:\/\/evil"/);
    assert.match(html, /&lt;script&gt;/);
    assert.match(html, /second line/);
    assert.match(html, /<br \/>/);
  });

  it("keeps the subject on one line", () => {
    const { subject } = tenantLeadReceived({ leadName: "Eve\r\nBcc: x@evil.test" });
    assert.doesNotMatch(subject, /[\r\n]/);
    assert.match(subject, /^New lead from your website: /);
  });

  it("omits rows for missing fields", () => {
    const { html } = tenantLeadReceived({ businessName: "Acme", leadName: "Jo", leadEmail: "jo@example.com" });
    assert.match(html, /Email/);
    assert.doesNotMatch(html, />Phone</);
    assert.doesNotMatch(html, />Message</);
  });

  it("is routed by renderEmailTemplate", () => {
    const { subject } = renderEmailTemplate("tenant_lead_received", { leadName: "Jo" });
    assert.match(subject, /New lead from your website: Jo/);
  });

  it("escapeHtml handles the five characters", () => {
    assert.equal(escapeHtml(`&<>"'`), "&amp;&lt;&gt;&quot;&#39;");
  });
});
