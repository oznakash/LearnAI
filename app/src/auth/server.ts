// Server-verified Google sign-in helpers.
//
// In production mode, the SPA hands the Google ID token to the mem0 server
// (POST /auth/google), which verifies it against Google's JWKS, mints a
// 7-day session JWT signed with JWT_SECRET, and returns it. Subsequent
// mem0 calls use that session JWT as the bearer.
//
// The session token also gates admin-only UI: the server sets is_admin
// based on its ADMIN_EMAILS env-var allowlist, and the SPA trusts the
// claim (it's signed by the server).
//
// Demo mode (the default for forks) skips this entirely — see
// `auth/google.ts`'s decode-only path.

const FETCH_TIMEOUT_MS = 10_000;

export interface ServerSession {
  /** Session JWT, signed by mem0 with JWT_SECRET. Used as Bearer for all subsequent mem0 calls. */
  token: string;
  email: string;
  name?: string;
  picture?: string;
  isAdmin: boolean;
  /** Unix seconds. Compare against `Date.now()/1000`. */
  expiresAt: number;
}

interface RawSignInResponse {
  session: string;
  user: { email: string; name?: string | null; picture?: string | null };
  is_admin: boolean;
  expires_at: number;
}

interface RawSessionResponse {
  email?: string | null;
  name?: string | null;
  picture?: string | null;
  is_admin: boolean;
  expires_at?: number | null;
  auth_type: string;
}

export class ServerAuthError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ServerAuthError";
    this.status = status;
  }
}

function trimTrailing(s: string): string {
  return s.replace(/\/+$/, "");
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = FETCH_TIMEOUT_MS
): Promise<Response> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctl.signal });
  } finally {
    clearTimeout(t);
  }
}

/** Exchange a Google ID token for a server-side session JWT. */
export async function serverSignIn(
  mem0Url: string,
  idToken: string
): Promise<ServerSession> {
  const base = trimTrailing(mem0Url);
  if (!base) throw new ServerAuthError(0, "mem0 URL is not configured.");
  const res = await fetchWithTimeout(`${base}/auth/google`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id_token: idToken }),
  });
  if (!res.ok) {
    let msg = `Sign-in failed (HTTP ${res.status}).`;
    try {
      const body = await res.json();
      if (body?.detail) msg = String(body.detail);
    } catch {
      /* keep generic message */
    }
    throw new ServerAuthError(res.status, msg);
  }
  const raw = (await res.json()) as RawSignInResponse;
  return {
    token: raw.session,
    email: raw.user.email,
    name: raw.user.name ?? undefined,
    picture: raw.user.picture ?? undefined,
    isAdmin: !!raw.is_admin,
    expiresAt: raw.expires_at,
  };
}

/** Validate a stored session JWT against the server. Returns null on 401/expiry. */
export async function validateServerSession(
  mem0Url: string,
  token: string
): Promise<ServerSession | null> {
  const base = trimTrailing(mem0Url);
  if (!base || !token) return null;
  let res: Response;
  try {
    res = await fetchWithTimeout(`${base}/auth/session`, {
      method: "GET",
      headers: { authorization: `Bearer ${token}` },
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;
  const raw = (await res.json()) as RawSessionResponse;
  if (raw.auth_type !== "google_session" || !raw.email || !raw.expires_at) return null;
  return {
    token,
    email: raw.email,
    name: raw.name ?? undefined,
    picture: raw.picture ?? undefined,
    isAdmin: !!raw.is_admin,
    expiresAt: raw.expires_at,
  };
}

/** Best-effort server-side signout. Returns even on network failure. */
export async function serverSignOut(mem0Url: string, token: string): Promise<void> {
  const base = trimTrailing(mem0Url);
  if (!base || !token) return;
  try {
    await fetchWithTimeout(
      `${base}/auth/google/signout`,
      {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
      },
      3_000
    );
  } catch {
    /* swallow — sessions are stateless, client-side discard is the real act */
  }
}

/** True if the session is missing or its expiry is in the past (with 60s grace). */
export function isSessionExpired(session: ServerSession | undefined | null): boolean {
  if (!session) return true;
  return session.expiresAt * 1000 - 60_000 <= Date.now();
}
