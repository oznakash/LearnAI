import { describe, expect, it } from "vitest";
import { normalizeReferrer } from "../lib/track-visit";

// We only unit-test the pure helpers here. The full beacon (sendBeacon
// fallback to fetch + sessionStorage idempotency) is exercised by the
// sidecar integration test (services/social-svc/__tests__/traffic.test.ts)
// which posts to the real /v1/social/track/visit endpoint.

describe("normalizeReferrer", () => {
  const origin = "https://learnai.cloud-claude.com";

  it("returns (direct) for empty referrer", () => {
    expect(normalizeReferrer("", origin)).toBe("(direct)");
  });

  it("returns (internal) for same-origin referrer", () => {
    expect(normalizeReferrer(`${origin}/topic/agents`, origin)).toBe("(internal)");
  });

  it("strips www. and returns bare host", () => {
    expect(normalizeReferrer("https://www.linkedin.com/post/abc", origin)).toBe(
      "linkedin.com",
    );
  });

  it("preserves multi-segment hosts like news.ycombinator.com", () => {
    expect(normalizeReferrer("https://news.ycombinator.com/item?id=1", origin)).toBe(
      "news.ycombinator.com",
    );
  });

  it("returns (direct) for malformed URLs instead of throwing", () => {
    expect(normalizeReferrer("not-a-url", origin)).toBe("(direct)");
  });

  it("downgrades twitter URL to twitter.com host", () => {
    expect(normalizeReferrer("https://twitter.com/u/status/1", origin)).toBe(
      "twitter.com",
    );
  });
});
