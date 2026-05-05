// LinkedIn OIDC integration — see docs/profile-linkedin.md.
//
// This module is the OIDC core: state-token sign/verify, authorize-URL
// builder, code exchange, userinfo fetch, and the bucket projection
// that turns a raw OIDC userinfo response into our two-bucket
// LinkedinIdentity record.
//
// Design notes:
//
//   - The HTTP fetcher is injected (`opts.fetcher`) so tests can stub
//     LinkedIn without going on the wire. Production passes
//     `globalThis.fetch`.
//
//   - State tokens are HMAC-signed (same JWT_SECRET as session JWTs)
//     and bind: account email + nonce + expiry. Single-use; the
//     consumed-set lives in memory next to the rate-limit bucket.
//
//   - Access tokens are NEVER returned outside this module. The
//     callback handler reads userinfo once and drops the token.

import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";
import type { LinkedinIdentity } from "./types.js";

// -- LinkedIn endpoints (constants are nice for swap-out in 1 line) ----------
export const LINKEDIN_AUTHORIZE_URL =
  "https://www.linkedin.com/oauth/v2/authorization";
export const LINKEDIN_TOKEN_URL =
  "https://www.linkedin.com/oauth/v2/accessToken";
export const LINKEDIN_USERINFO_URL = "https://api.linkedin.com/v2/userinfo";

// Three OIDC scopes. No `w_member_social` (we never request post-on-behalf
// at connect-time). See docs/profile-linkedin.md §5 / §8.
export const LINKEDIN_SCOPES = ["openid", "profile", "email"] as const;

/** State-token TTL. 5 minutes is plenty for an OAuth round-trip. */
export const STATE_TTL_MS = 5 * 60 * 1000;

// -- Public types ------------------------------------------------------------

export interface LinkedinConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  /** HMAC secret for state tokens. Same value as session-JWT secret. */
  hmacSecret: string;
  /**
   * Injected fetcher. Production: `globalThis.fetch`. Tests: a stub
   * matching the Fetch API shape.
   */
  fetcher?: typeof fetch;
}

/** OIDC userinfo response shape, as returned by LinkedIn's /v2/userinfo. */
export interface LinkedinUserInfo {
  sub: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  email?: string;
  email_verified?: boolean;
  picture?: string;
  locale?: string;
  [k: string]: unknown;
}

// -- State tokens ------------------------------------------------------------

/**
 * Structure encoded in the `state` query param:
 *   <base64url(payload)>.<hex(hmac)>
 * payload = { e: email, n: nonce, x: expiryMs, v: 1 }
 */
interface StatePayload {
  /** LearnAI account email (lowercased). */
  e: string;
  /** Random nonce — also the single-use key. */
  n: string;
  /** Expiry epoch ms. */
  x: number;
  /** Version. Bump if we change the shape. */
  v: 1;
}

const b64url = (buf: Buffer): string =>
  buf.toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");

const fromB64url = (s: string): Buffer =>
  Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");

/**
 * Sign a state token binding `email` to a single-use nonce.
 * Returns both the encoded token (for the redirect URL) and the nonce
 * (so the caller can record it for replay defense).
 */
export function signStateToken(
  email: string,
  hmacSecret: string,
  now = Date.now(),
): { token: string; nonce: string; expiresAt: number } {
  const nonce = randomBytes(16).toString("hex");
  const payload: StatePayload = {
    e: email.toLowerCase(),
    n: nonce,
    x: now + STATE_TTL_MS,
    v: 1,
  };
  const json = JSON.stringify(payload);
  const body = b64url(Buffer.from(json, "utf8"));
  const mac = createHmac("sha256", hmacSecret).update(body).digest();
  const token = `${body}.${b64url(mac)}`;
  return { token, nonce, expiresAt: payload.x };
}

export type StateVerifyError =
  | "malformed"
  | "bad_signature"
  | "expired"
  | "version_mismatch";

/**
 * Verify a state token and return its payload. Caller is responsible
 * for the single-use check (consumed-set lookup) — the token can be
 * cryptographically valid AND replayed; only one of those is the
 * primitive's job.
 */
export function verifyStateToken(
  token: string,
  hmacSecret: string,
  now = Date.now(),
): { ok: true; payload: StatePayload } | { ok: false; reason: StateVerifyError } {
  const dot = token.lastIndexOf(".");
  if (dot < 0) return { ok: false, reason: "malformed" };
  const body = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  let macBuf: Buffer;
  try {
    macBuf = fromB64url(mac);
  } catch {
    return { ok: false, reason: "malformed" };
  }
  const expected = createHmac("sha256", hmacSecret).update(body).digest();
  if (
    macBuf.length !== expected.length ||
    !timingSafeEqual(macBuf, expected)
  ) {
    return { ok: false, reason: "bad_signature" };
  }
  let payload: StatePayload;
  try {
    payload = JSON.parse(fromB64url(body).toString("utf8")) as StatePayload;
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (payload.v !== 1) return { ok: false, reason: "version_mismatch" };
  if (
    typeof payload.e !== "string" ||
    typeof payload.n !== "string" ||
    typeof payload.x !== "number"
  ) {
    return { ok: false, reason: "malformed" };
  }
  if (now > payload.x) return { ok: false, reason: "expired" };
  return { ok: true, payload };
}

// -- Authorize URL -----------------------------------------------------------

export function buildAuthorizeUrl(
  cfg: Pick<LinkedinConfig, "clientId" | "redirectUri">,
  state: string,
): string {
  const u = new URL(LINKEDIN_AUTHORIZE_URL);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("client_id", cfg.clientId);
  u.searchParams.set("redirect_uri", cfg.redirectUri);
  u.searchParams.set("scope", LINKEDIN_SCOPES.join(" "));
  u.searchParams.set("state", state);
  return u.toString();
}

// -- Code exchange + userinfo ------------------------------------------------

export class LinkedinExchangeError extends Error {
  constructor(
    public readonly stage: "token" | "userinfo",
    public readonly status: number,
    public readonly detail: string,
  ) {
    super(`linkedin_${stage}_failed: ${status} ${detail}`);
    this.name = "LinkedinExchangeError";
  }
}

interface TokenResponse {
  access_token: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
}

/**
 * Exchange the OAuth code for an access_token. Server-to-server.
 * The returned token is intentionally short-lived in our use: read
 * userinfo, drop the token, never persist.
 */
export async function exchangeCodeForToken(
  code: string,
  cfg: LinkedinConfig,
): Promise<TokenResponse> {
  const fetcher = cfg.fetcher ?? fetch;
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: cfg.redirectUri,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
  });
  const r = await fetcher(LINKEDIN_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!r.ok) {
    let detail = "";
    try {
      detail = await r.text();
    } catch {
      /* ignore */
    }
    throw new LinkedinExchangeError("token", r.status, detail.slice(0, 200));
  }
  return (await r.json()) as TokenResponse;
}

/**
 * Fetch the OIDC userinfo claims with a bearer access_token.
 */
export async function fetchUserInfo(
  accessToken: string,
  cfg: LinkedinConfig,
): Promise<LinkedinUserInfo> {
  const fetcher = cfg.fetcher ?? fetch;
  const r = await fetcher(LINKEDIN_USERINFO_URL, {
    headers: {
      authorization: `Bearer ${accessToken}`,
      accept: "application/json",
    },
  });
  if (!r.ok) {
    let detail = "";
    try {
      detail = await r.text();
    } catch {
      /* ignore */
    }
    throw new LinkedinExchangeError("userinfo", r.status, detail.slice(0, 200));
  }
  const claims = (await r.json()) as LinkedinUserInfo;
  if (!claims || typeof claims.sub !== "string" || !claims.sub) {
    throw new LinkedinExchangeError("userinfo", 200, "missing_sub");
  }
  return claims;
}

// -- Bucket projection -------------------------------------------------------

/**
 * Project a raw OIDC userinfo response into our two-bucket
 * LinkedinIdentity record. See docs/profile-linkedin.md §2.
 *
 *   visible  — name + photo + email; one-time grab, seeded into
 *              ProfileRecord, owned by the user from there.
 *   context  — sub + verified + locale + derived fields
 *              (emailDomain, pictureCdnHost) + raw claims; immutable;
 *              powers recommendations + future features.
 */
export function projectUserInfo(
  email: string,
  claims: LinkedinUserInfo,
  now = Date.now(),
): LinkedinIdentity {
  const lowerEmail = email.toLowerCase();
  const liEmail = typeof claims.email === "string" ? claims.email : undefined;
  const emailDomain = liEmail && liEmail.includes("@")
    ? liEmail.split("@").pop()?.toLowerCase()
    : undefined;
  let pictureCdnHost: string | undefined;
  if (typeof claims.picture === "string") {
    try {
      pictureCdnHost = new URL(claims.picture).host.toLowerCase();
    } catch {
      /* not a parseable URL — drop the derived field */
    }
  }
  return {
    email: lowerEmail,
    visible: {
      name: typeof claims.name === "string" ? claims.name : "",
      givenName:
        typeof claims.given_name === "string" ? claims.given_name : undefined,
      familyName:
        typeof claims.family_name === "string" ? claims.family_name : undefined,
      pictureUrl:
        typeof claims.picture === "string" ? claims.picture : undefined,
      email: liEmail,
    },
    context: {
      sub: claims.sub,
      emailVerified:
        typeof claims.email_verified === "boolean"
          ? claims.email_verified
          : undefined,
      locale: typeof claims.locale === "string" ? claims.locale : undefined,
      emailDomain,
      pictureCdnHost,
      rawClaims: { ...claims },
      connectedAt: now,
      refreshedAt: now,
    },
  };
}

// -- Single-use nonce tracker ------------------------------------------------

/**
 * Tiny in-memory single-use tracker. Records nonces of consumed state
 * tokens until they expire. Replay attempts hit `has(nonce)` and are
 * rejected.
 *
 * Production note: in a multi-process deploy we'd want this in Redis.
 * For the single-replica social-svc we run today, in-memory is fine.
 */
export interface NonceTracker {
  consume(nonce: string, expiresAt: number): "fresh" | "replay";
  /** For tests. */
  size(): number;
}

export function inMemoryNonceTracker(): NonceTracker {
  const consumed = new Map<string, number>();
  // Lazy GC: prune on every consume call.
  const prune = (now: number) => {
    for (const [k, exp] of consumed) {
      if (exp <= now) consumed.delete(k);
    }
  };
  return {
    consume(nonce, expiresAt) {
      const now = Date.now();
      prune(now);
      if (consumed.has(nonce)) return "replay";
      consumed.set(nonce, expiresAt);
      return "fresh";
    },
    size() {
      return consumed.size;
    },
  };
}
