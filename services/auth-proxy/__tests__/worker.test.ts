import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleRequest } from "../src/worker.js";
import { inMemoryKV } from "../src/rate-limit.js";
import { makeFakeIdToken } from "../src/verify.js";
import type { Env } from "../src/types.js";

const fetchMock = vi.fn<typeof fetch>();
const originalFetch = globalThis.fetch;

beforeEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    GOOGLE_OAUTH_CLIENT_ID: "test-client.apps.googleusercontent.com",
    SOCIAL_SVC_URL: "https://social.test",
    MEM0_URL: "https://mem0.test",
    UPSTREAM_KEY_SOCIAL: "social-secret",
    UPSTREAM_KEY_MEM0: "mem0-secret",
    RATE_LIMITS: inMemoryKV(),
    ALLOW_DEMO_HEADER: "0",
    ALLOWED_ORIGINS: "*",
    TEST_BYPASS_VERIFY: "1",
    ...overrides,
  };
}

const validTokenForMaya = () =>
  makeFakeIdToken({
    email: "maya@gmail.com",
    email_verified: true,
    aud: "test-client.apps.googleusercontent.com",
    iss: "https://accounts.google.com",
    exp: Math.floor(Date.now() / 1000) + 3600,
  });

describe("auth-proxy worker", () => {
  it("OPTIONS preflight returns 204 with CORS", async () => {
    const env = makeEnv();
    const r = await handleRequest(
      new Request("https://proxy.test/v1/social/me", {
        method: "OPTIONS",
        headers: { origin: "https://app.test" },
      }),
      env,
    );
    expect(r.status).toBe(204);
    expect(r.headers.get("access-control-allow-origin")).toBeTruthy();
  });

  it("/health returns 200 without auth", async () => {
    const env = makeEnv();
    const r = await handleRequest(
      new Request("https://proxy.test/health"),
      env,
    );
    expect(r.status).toBe(200);
    const body = await r.json() as { status: string };
    expect(body.status).toBe("ok");
  });

  it("requests without an ID token are rejected with 401", async () => {
    const env = makeEnv();
    const r = await handleRequest(
      new Request("https://proxy.test/v1/social/me"),
      env,
    );
    expect(r.status).toBe(401);
    const body = await r.json() as { error: string };
    expect(body.error).toBe("missing_token");
  });

  it("ALLOW_DEMO_HEADER=1 lets unauthenticated demo-mode through with X-User-Email", async () => {
    const env = makeEnv({ ALLOW_DEMO_HEADER: "1" });
    fetchMock.mockResolvedValue(new Response("{}", { status: 200, headers: { "content-type": "application/json" } }));
    const r = await handleRequest(
      new Request("https://proxy.test/v1/social/me", {
        headers: { "x-user-email": "demo@gmail.com" },
      }),
      env,
    );
    expect(r.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("ID token without Gmail address is rejected with 401 (verify path)", async () => {
    const env = makeEnv({ TEST_BYPASS_VERIFY: undefined });
    const token = makeFakeIdToken({ email: "user@example.com", email_verified: true });
    const r = await handleRequest(
      new Request("https://proxy.test/v1/social/me", {
        headers: { "x-id-token": token },
      }),
      env,
    );
    expect(r.status).toBe(401);
  });

  it("verified token forwards with X-User-Email + upstream Bearer + path", async () => {
    const env = makeEnv();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: 1 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const r = await handleRequest(
      new Request("https://proxy.test/v1/social/me", {
        headers: { "x-id-token": validTokenForMaya() },
      }),
      env,
    );
    expect(r.status).toBe(200);
    const [forwardUrl, init] = fetchMock.mock.calls[0]!;
    expect(String(forwardUrl)).toBe("https://social.test/v1/social/me");
    const headers = (init?.headers as Headers).constructor === Headers
      ? Object.fromEntries((init?.headers as Headers).entries())
      : (init?.headers as Record<string, string>);
    expect(headers["x-user-email"]).toBe("maya@gmail.com");
    expect(headers["authorization"]).toBe("Bearer social-secret");
    expect(headers["x-id-token"]).toBeUndefined();
  });

  it("/v1/memories/* forwards to MEM0_URL with the mem0 bearer", async () => {
    const env = makeEnv();
    fetchMock.mockResolvedValue(new Response("[]", { status: 200, headers: { "content-type": "application/json" } }));
    await handleRequest(
      new Request("https://proxy.test/v1/memories/?user_id=maya@gmail.com", {
        headers: { "x-id-token": validTokenForMaya() },
      }),
      env,
    );
    const [forwardUrl, init] = fetchMock.mock.calls[0]!;
    expect(String(forwardUrl)).toBe("https://mem0.test/v1/memories/?user_id=maya@gmail.com");
    const headers = Object.fromEntries((init?.headers as Headers).entries());
    expect(headers["authorization"]).toBe("Bearer mem0-secret");
  });

  it("rate limits per email — 5 reports/min then 429", async () => {
    const env = makeEnv();
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    const send = () =>
      handleRequest(
        new Request("https://proxy.test/v1/social/reports", {
          method: "POST",
          headers: { "x-id-token": validTokenForMaya(), "content-type": "application/json" },
          body: JSON.stringify({ targetHandle: "x", reason: "spam" }),
        }),
        env,
      );
    for (let i = 0; i < 5; i++) {
      const r = await send();
      expect(r.status).toBe(204);
    }
    const limited = await send();
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBeTruthy();
  });

  it("unknown paths return 404", async () => {
    const env = makeEnv();
    const r = await handleRequest(
      new Request("https://proxy.test/v1/something-else", {
        headers: { "x-id-token": validTokenForMaya() },
      }),
      env,
    );
    expect(r.status).toBe(404);
  });

  it("upstream errors are passed through to the client", async () => {
    const env = makeEnv();
    fetchMock.mockResolvedValue(new Response("server boom", { status: 503 }));
    const r = await handleRequest(
      new Request("https://proxy.test/v1/social/me", {
        headers: { "x-id-token": validTokenForMaya() },
      }),
      env,
    );
    expect(r.status).toBe(503);
  });
});
