import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OnlineSocialService } from "../social/online";
import { selectSocialService } from "../social";

const fetchMock = vi.fn<typeof fetch>();
const originalFetch = globalThis.fetch;

beforeEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

function emptyResponse(status = 204): Response {
  return new Response(null, { status });
}

const svc = () =>
  new OnlineSocialService({
    serverUrl: "https://social.example.com",
    apiKey: "test-key",
    userEmail: "maya@gmail.com",
  });

describe("OnlineSocialService — request shaping", () => {
  it("getMyProfile sends X-User-Email + Authorization", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ email: "maya@gmail.com", handle: "maya" }),
    );
    const me = await svc().getMyProfile();
    expect(me.handle).toBe("maya");
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://social.example.com/v1/social/me");
    const headers = (init?.headers ?? {}) as Record<string, string>;
    expect(headers["x-user-email"]).toBe("maya@gmail.com");
    expect(headers["authorization"]).toBe("Bearer test-key");
  });

  it("getProfile maps 404 to null", async () => {
    fetchMock.mockResolvedValue(
      new Response("not found", { status: 404 }),
    );
    const r = await svc().getProfile("missing");
    expect(r).toBeNull();
  });

  it("follow → POST /v1/social/follow/:handle", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ follower: "maya@gmail.com", target: "priya@gmail.com", status: "approved", muted: false, createdAt: 0 }),
    );
    const e = await svc().follow("priya");
    expect(e.target).toBe("priya@gmail.com");
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://social.example.com/v1/social/follow/priya");
    expect(init?.method).toBe("POST");
  });

  it("unfollow → DELETE /v1/social/follow/:handle (204 → undefined)", async () => {
    fetchMock.mockResolvedValue(emptyResponse(204));
    await svc().unfollow("priya");
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://social.example.com/v1/social/follow/priya");
    expect(init?.method).toBe("DELETE");
  });

  it("block → POST /v1/social/blocks/:handle", async () => {
    fetchMock.mockResolvedValue(emptyResponse(204));
    await svc().block("priya");
    const [url] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://social.example.com/v1/social/blocks/priya");
  });

  it("report → POST /v1/social/reports with sanitized body", async () => {
    fetchMock.mockResolvedValue(emptyResponse(204));
    await svc().report("priya", "spam", "noisy", { kind: "profile" });
    const [, init] = fetchMock.mock.calls[0]!;
    expect(JSON.parse((init?.body as string) ?? "{}")).toEqual({
      targetHandle: "priya",
      reason: "spam",
      note: "noisy",
      context: { kind: "profile" },
    });
  });

  it("setSignals → PUT /v1/social/me/signals; returns server-capped list", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ topics: ["ai-foundations", "ai-pm", "ai-builder", "ai-trends", "ai-news"] }),
    );
    const got = await svc().setSignals([
      "ai-foundations",
      "ai-pm",
      "ai-builder",
      "ai-trends",
      "ai-news",
      "memory-safety",
    ] as never);
    expect(got.length).toBe(5);
  });

  it("getStream forwards limit + before as query params", async () => {
    fetchMock.mockResolvedValue(jsonResponse([]));
    await svc().getStream({ limit: 10, before: 12345 });
    const [url] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain("limit=10");
    expect(String(url)).toContain("before=12345");
  });

  it("health returns ok:false when fetch rejects (e.g. timeout)", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    const h = await svc().health();
    expect(h.ok).toBe(false);
    expect(h.backend).toBe("online");
  });

  it("non-2xx that's not 404 throws (caller wraps with withSocialGuard)", async () => {
    fetchMock.mockResolvedValue(new Response("server error", { status: 500 }));
    await expect(svc().getMyProfile()).rejects.toThrow(/HTTP 500/);
  });
});

describe("selectSocialService", () => {
  it("returns OnlineSocialService when socialEnabled + serverUrl + email all set", () => {
    const got = selectSocialService({
      email: "maya@gmail.com",
      socialEnabled: true,
      serverUrl: "https://social.example.com",
    });
    expect(got).toBeInstanceOf(OnlineSocialService);
  });

  it("returns OnlineSocialService with same-origin (empty serverUrl) when a bearer is present (production-mode sidecar signal)", () => {
    const got = selectSocialService({
      email: "maya@gmail.com",
      socialEnabled: true,
      serverUrl: "",
      bearerToken: "session-jwt",
    });
    expect(got).toBeInstanceOf(OnlineSocialService);
  });

  it("falls back to OfflineSocialService when serverUrl AND bearer are both empty (no sidecar reachable)", () => {
    // Reproduces the live SparkStream hang: socialEnabled=true but neither
    // a configured serverUrl nor a session bearer means relative fetches
    // hit the SPA fallback (index.html for /v1/social/*), the JSON client
    // returns undefined, and callers crash on `result.map(...)`. Stay
    // offline so mock cards render instead of hanging the view.
    const got = selectSocialService({
      email: "maya@gmail.com",
      socialEnabled: true,
      serverUrl: "",
      bearerToken: "",
    });
    expect(got).not.toBeInstanceOf(OnlineSocialService);
  });

  it("treats whitespace-only serverUrl/bearer as empty for the fallback check", () => {
    const got = selectSocialService({
      email: "maya@gmail.com",
      socialEnabled: true,
      serverUrl: "   ",
      bearerToken: "  ",
    });
    expect(got).not.toBeInstanceOf(OnlineSocialService);
  });
});

describe("OnlineSocialService — same-origin behavior", () => {
  it("makes a relative-URL fetch when serverUrl is empty", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ email: "maya@gmail.com", handle: "maya" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const sameOrigin = new OnlineSocialService({
      serverUrl: "",
      apiKey: "tok",
      userEmail: "maya@gmail.com",
    });
    await sameOrigin.getMyProfile();
    const [url] = fetchMock.mock.calls[0]!;
    // Empty base ⇒ path-only; resolves against the page origin in browser.
    expect(String(url)).toBe("/v1/social/me");
  });
});
