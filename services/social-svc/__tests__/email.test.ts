import { describe, it, expect } from "vitest";
import { htmlToText, buildListUnsubHeaders } from "../src/email.js";

// These cover the deliverability hygiene added in PR followup to #58:
// 1. Plain-text alternative (htmlToText) so every send is multipart.
// 2. List-Unsubscribe / List-Unsubscribe-Post (RFC 2369 + RFC 8058).
//
// We intentionally do NOT test sendEmail() against a live SMTP server
// here — that path is exercised by the live smoke (curl /v1/email/send
// in deploy verification). These tests are purely about the header /
// body shaping, which is what the spam-filter heuristics actually read.

describe("htmlToText", () => {
  it("strips tags and yields readable text", () => {
    const out = htmlToText("<p>Hello <b>world</b></p>");
    expect(out).toBe("Hello world");
  });

  it("turns paragraphs into double line breaks and br into single", () => {
    const out = htmlToText("<p>One</p><p>Two<br>Three</p>");
    expect(out).toBe("One\n\nTwo\nThree");
  });

  it("renders list items with bullets", () => {
    const out = htmlToText("<ul><li>A</li><li>B</li></ul>");
    expect(out).toBe("• A\n• B");
  });

  it("drops <style> and <script> bodies", () => {
    const out = htmlToText(
      "<style>.x{color:red}</style><script>alert(1)</script><p>visible</p>",
    );
    expect(out).toBe("visible");
  });

  it("decodes the common HTML entities", () => {
    const out = htmlToText("<p>5 &lt; 10 &amp; you&#39;re &quot;in&quot;</p>");
    expect(out).toBe(`5 < 10 & you're "in"`);
  });
});

describe("buildListUnsubHeaders", () => {
  it("always emits a mailto-only List-Unsubscribe when no URL given", () => {
    const h = buildListUnsubHeaders("learnai@useyl.com");
    expect(h["List-Unsubscribe"]).toBe(
      "<mailto:learnai@useyl.com?subject=unsubscribe>",
    );
    // No one-click POST header without an HTTPS URL — that header is
    // RFC 8058 only.
    expect(h["List-Unsubscribe-Post"]).toBeUndefined();
  });

  it("emits URL + mailto + one-click POST when given an HTTPS unsubscribe URL", () => {
    const h = buildListUnsubHeaders(
      "learnai@useyl.com",
      "https://learnai-b94d78.cloud-claude.com/u?t=abc",
    );
    expect(h["List-Unsubscribe"]).toBe(
      "<https://learnai-b94d78.cloud-claude.com/u?t=abc>, <mailto:learnai@useyl.com?subject=unsubscribe>",
    );
    expect(h["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
  });

  it("falls back to mailto-only and skips one-click POST for non-HTTPS URLs", () => {
    const h = buildListUnsubHeaders(
      "learnai@useyl.com",
      "http://insecure.example.com/u",
    );
    expect(h["List-Unsubscribe"]).toBe(
      "<mailto:learnai@useyl.com?subject=unsubscribe>",
    );
    expect(h["List-Unsubscribe-Post"]).toBeUndefined();
  });
});
