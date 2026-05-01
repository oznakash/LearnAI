// Google ID token verification. Uses Google's published JWKS endpoint
// + `jose` for signature verification.
//
// Production: this caches the JWKS keys for ~1 day (jose handles that).
// Tests: bypassed via TEST_BYPASS_VERIFY=1 + X-Demo-Email header.

import { createRemoteJWKSet, jwtVerify } from "jose";
import type { ClaimsLite, Env } from "./types.js";

const JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const ISSUERS = [
  "https://accounts.google.com",
  "accounts.google.com",
];

let cachedJwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks(): ReturnType<typeof createRemoteJWKSet> {
  if (!cachedJwks) {
    cachedJwks = createRemoteJWKSet(new URL(JWKS_URL));
  }
  return cachedJwks;
}

export async function verifyIdToken(
  token: string,
  env: Env,
): Promise<ClaimsLite> {
  if (env.TEST_BYPASS_VERIFY === "1") {
    // Decode the body without verification — for tests only.
    const parts = token.split(".");
    if (parts.length !== 3) throw new Error("invalid_token");
    const payloadJson = JSON.parse(
      atob(parts[1]!.replace(/-/g, "+").replace(/_/g, "/")),
    );
    return payloadJson as ClaimsLite;
  }
  const { payload } = await jwtVerify(token, getJwks(), {
    issuer: ISSUERS,
    audience: env.GOOGLE_OAUTH_CLIENT_ID,
  });
  if (typeof payload.email !== "string" || !payload.email.toLowerCase().endsWith("@gmail.com")) {
    throw new Error("not_gmail");
  }
  if (payload.email_verified !== true) {
    throw new Error("email_not_verified");
  }
  return payload as unknown as ClaimsLite;
}

/** Test helper: hand-craft an unverified ID-token-shaped string. */
export function makeFakeIdToken(claims: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: "none", typ: "JWT" }))
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  const body = btoa(JSON.stringify(claims))
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  return `${header}.${body}.sig`;
}
