// Session-JWT verification.
//
// We trust the session JWT that mem0 mints (HS256 signed with JWT_SECRET).
// Sidecar shares the same JWT_SECRET as mem0 (operator sets it once on
// the cloud-claude environment). Verifying here means no extra round-
// trip to mem0 on every request.
//
// The shape of the session JWT is set by mem0:
//   { sub, email, email_verified, is_admin, iat, exp }
//
// Demo / fork mode (DEMO_TRUST_HEADER=1) lets the SPA send X-User-Email
// directly, no token. Useful for forks running locally without OAuth.
// Refused at boot when NODE_ENV=production.

import { jwtVerify } from "jose";

export interface SessionClaims {
  sub: string;
  email: string;
  email_verified?: boolean;
  is_admin?: boolean;
  exp?: number;
  iat?: number;
}

export interface VerifyOpts {
  /** HMAC secret. Same value as mem0's JWT_SECRET. */
  secret: string;
}

let cachedKey: Uint8Array | null = null;
let cachedSecret = "";

function keyFor(secret: string): Uint8Array {
  if (cachedKey && cachedSecret === secret) return cachedKey;
  cachedSecret = secret;
  cachedKey = new TextEncoder().encode(secret);
  return cachedKey;
}

export async function verifySessionJwt(
  token: string,
  opts: VerifyOpts,
): Promise<SessionClaims> {
  const { payload } = await jwtVerify(token, keyFor(opts.secret), {
    algorithms: ["HS256"],
  });
  if (typeof payload.email !== "string") throw new Error("missing_email_claim");
  return payload as unknown as SessionClaims;
}
