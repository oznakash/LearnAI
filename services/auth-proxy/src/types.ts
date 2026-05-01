// Cloudflare Worker bindings. The Worker needs:
//  - SOCIAL_SVC_URL / MEM0_URL: forwarding targets (set in wrangler.toml).
//  - GOOGLE_OAUTH_CLIENT_ID: audience claim to verify.
//  - UPSTREAM_KEY_SOCIAL / UPSTREAM_KEY_MEM0: bearer secrets the Worker
//    swaps in before forwarding (the SPA never sees these).
//  - RATE_LIMITS: a KV namespace for sliding-window rate buckets. (Tests
//    swap in a Map-backed shim.)

export interface Env {
  GOOGLE_OAUTH_CLIENT_ID: string;
  SOCIAL_SVC_URL: string;
  MEM0_URL: string;
  UPSTREAM_KEY_SOCIAL?: string;
  UPSTREAM_KEY_MEM0?: string;
  RATE_LIMITS?: KVLikeNamespace;
  /** When true, allow demo-mode requests sending X-User-Email directly (no token). */
  ALLOW_DEMO_HEADER?: string;
  /** ISO list of allowed origins for CORS responses. "*" allowed in dev. */
  ALLOWED_ORIGINS?: string;
  /** Test override: bypass JWT verification and trust the X-Demo-Email header. */
  TEST_BYPASS_VERIFY?: string;
}

/**
 * Minimal subset of the Cloudflare KV API the Worker uses. Letting tests
 * swap in a Map-backed shim avoids pulling in @cloudflare/workers-types.
 */
export interface KVLikeNamespace {
  get(key: string): Promise<string | null>;
  put(
    key: string,
    value: string,
    opts?: { expirationTtl?: number },
  ): Promise<void>;
}

export interface ClaimsLite {
  email: string;
  email_verified: boolean;
  aud: string;
  iss: string;
  exp: number;
}
