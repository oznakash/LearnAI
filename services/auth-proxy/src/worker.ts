// LearnAI auth-verifying proxy.
//
// Sits in front of mem0 + social-svc. Verifies the SPA's Google ID token,
// injects X-User-Email server-side (the verified email claim), rate-
// limits per email, swaps in upstream API keys (kept out of the browser),
// and forwards the request.
//
// Request shape from the SPA:
//   - Header: X-Id-Token: <Google ID token>
//   - Path: /v1/social/... or /v1/memories/... (or /health on either)
//
// What the upstream sees:
//   - Header: X-User-Email: <verified gmail>
//   - Header: Authorization: Bearer <UPSTREAM_KEY_*>
//   - Original path + body, untouched
//
// Demo mode (operator opt-in via ALLOW_DEMO_HEADER=1): the SPA can
// instead send X-User-Email directly, no token. Useful for forks
// running locally without OAuth.

import { consume, type RateRule } from "./rate-limit.js";
import type { Env } from "./types.js";
import { verifyIdToken } from "./verify.js";

interface RouteTarget {
  upstreamUrl: string;
  bearerKey?: string;
  rule: RateRule;
}

const DEFAULT_RULES: Record<string, RateRule> = {
  "social-write": { action: "social_write", perMinute: 60, perHour: 600 },
  "social-read": { action: "social_read", perMinute: 600, perHour: 6000 },
  "social-report": { action: "social_report", perMinute: 5, perHour: 20 },
  "social-snapshot": { action: "social_snapshot", perMinute: 60, perHour: 1800 },
  "mem0-write": { action: "mem0_write", perMinute: 30, perHour: 300 },
  "mem0-read": { action: "mem0_read", perMinute: 600, perHour: 6000 },
};

function corsHeaders(env: Env, origin: string | null): Record<string, string> {
  const allowed = (env.ALLOWED_ORIGINS ?? "*")
    .split(",")
    .map((s) => s.trim());
  const allow = allowed.includes("*")
    ? "*"
    : origin && allowed.includes(origin)
      ? origin
      : "";
  return {
    ...(allow ? { "access-control-allow-origin": allow } : {}),
    "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
    "access-control-allow-headers": "content-type,authorization,x-id-token,x-user-email",
    vary: "origin",
  };
}

function pickRoute(env: Env, pathname: string, method: string): RouteTarget | null {
  // Health passthrough (no auth, no rate limit).
  if (pathname === "/health") return null;

  if (pathname.startsWith("/v1/social/me/snapshot")) {
    return {
      upstreamUrl: env.SOCIAL_SVC_URL,
      bearerKey: env.UPSTREAM_KEY_SOCIAL,
      rule: DEFAULT_RULES["social-snapshot"]!,
    };
  }
  if (pathname.startsWith("/v1/social/reports")) {
    return {
      upstreamUrl: env.SOCIAL_SVC_URL,
      bearerKey: env.UPSTREAM_KEY_SOCIAL,
      rule: DEFAULT_RULES["social-report"]!,
    };
  }
  if (pathname.startsWith("/v1/social/")) {
    const isWrite = method !== "GET";
    return {
      upstreamUrl: env.SOCIAL_SVC_URL,
      bearerKey: env.UPSTREAM_KEY_SOCIAL,
      rule: isWrite ? DEFAULT_RULES["social-write"]! : DEFAULT_RULES["social-read"]!,
    };
  }
  if (pathname.startsWith("/v1/memories")) {
    const isWrite = method !== "GET";
    return {
      upstreamUrl: env.MEM0_URL,
      bearerKey: env.UPSTREAM_KEY_MEM0,
      rule: isWrite ? DEFAULT_RULES["mem0-write"]! : DEFAULT_RULES["mem0-read"]!,
    };
  }
  return null;
}

export async function handleRequest(
  request: Request,
  env: Env,
): Promise<Response> {
  const url = new URL(request.url);
  const origin = request.headers.get("origin");
  const cors = corsHeaders(env, origin);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  // Healthchecks pass straight through to the requested upstream.
  if (url.pathname === "/health") {
    // Default: report the proxy's own health (no upstream lookup).
    return new Response(
      JSON.stringify({ status: "ok", proxy: "auth-verify", version: "0.1.0" }),
      { status: 200, headers: { "content-type": "application/json", ...cors } },
    );
  }

  const route = pickRoute(env, url.pathname, request.method);
  if (!route) {
    return new Response(JSON.stringify({ error: "not_found" }), {
      status: 404,
      headers: { "content-type": "application/json", ...cors },
    });
  }

  // -- Authenticate -------------------------------------------------------
  let email: string | null = null;
  const idToken = request.headers.get("x-id-token");
  if (idToken) {
    try {
      const claims = await verifyIdToken(idToken, env);
      email = claims.email;
    } catch (e) {
      return new Response(
        JSON.stringify({ error: "invalid_token", detail: (e as Error).message }),
        { status: 401, headers: { "content-type": "application/json", ...cors } },
      );
    }
  } else if (env.ALLOW_DEMO_HEADER === "1") {
    const demo = request.headers.get("x-user-email");
    if (demo && demo.includes("@")) email = demo;
  }
  if (!email) {
    return new Response(JSON.stringify({ error: "missing_token" }), {
      status: 401,
      headers: { "content-type": "application/json", ...cors },
    });
  }

  // -- Rate limit ---------------------------------------------------------
  const rate = await consume(env.RATE_LIMITS, email, route.rule);
  if (!rate.ok) {
    return new Response(
      JSON.stringify({ error: "rate_limited", reason: rate.reason }),
      {
        status: 429,
        headers: {
          "content-type": "application/json",
          "retry-after": String(rate.retryAfter),
          ...cors,
        },
      },
    );
  }

  // -- Forward ------------------------------------------------------------
  const forwardUrl = new URL(route.upstreamUrl);
  // Append upstream pathname/search to the upstream base.
  forwardUrl.pathname = forwardUrl.pathname.replace(/\/+$/, "") + url.pathname;
  forwardUrl.search = url.search;

  const forwardHeaders = new Headers(request.headers);
  forwardHeaders.delete("x-id-token");
  forwardHeaders.delete("authorization");
  forwardHeaders.set("x-user-email", email);
  if (route.bearerKey) {
    forwardHeaders.set("authorization", `Bearer ${route.bearerKey}`);
  }
  // Drop hop-by-hop headers that fetch may not handle gracefully.
  forwardHeaders.delete("host");
  forwardHeaders.delete("content-length");

  // Body: only present on non-GET. Clone the request body buffer.
  const init: RequestInit = {
    method: request.method,
    headers: forwardHeaders,
  };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }

  const upstream = await fetch(forwardUrl.toString(), init);

  // Mirror the response 1:1 with CORS overlay.
  const respHeaders = new Headers(upstream.headers);
  for (const [k, v] of Object.entries(cors)) respHeaders.set(k, v);
  // Strip server-side authorization echoes if any.
  respHeaders.delete("set-cookie");

  return new Response(upstream.body, {
    status: upstream.status,
    headers: respHeaders,
  });
}

export default {
  fetch: handleRequest,
};
