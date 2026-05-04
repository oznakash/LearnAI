import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { createStore, type Store } from "../src/store.js";
import {
  inMemoryNonceTracker,
  projectUserInfo,
  signStateToken,
  verifyStateToken,
  STATE_TTL_MS,
  type LinkedinUserInfo,
  type NonceTracker,
} from "../src/linkedin.js";

/**
 * LinkedIn Connect — strategy + two-bucket model in
 * docs/profile-linkedin.md. These tests pin:
 *
 *   - the state-token primitive (sign / verify, expiry, replay)
 *   - the userinfo → bucket projection
 *   - the public config probe
 *   - the start endpoint (auth + URL shape)
 *   - the callback's error paths (state mismatch, replay, OAuth error,
 *     missing code)
 *   - the callback's happy path (code → token → userinfo → store)
 *   - the dedup guard (one LinkedIn → one LearnAI)
 *   - GET / DELETE /v1/social/me/linkedin
 *   - the cascade delete from `deleteProfileCascade`
 *   - the disabled-mode behavior (config returns enabled=false; routes
 *     refuse with 503)
 */

const HMAC_SECRET = "test-hmac-secret-32-chars-minimum-1234567890";
const userHeaders = (email: string) => ({ "x-user-email": email });

// Stub LinkedIn endpoints. Returns whatever's queued for the matching
// URL. Tests push fixtures via `queue(url, response)`.
function makeStubFetcher() {
  const responses: Array<{ url: string; status: number; body: unknown }> = [];
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetcher = (async (url: string | URL | Request, init?: RequestInit) => {
    const urlStr = typeof url === "string" ? url : url.toString();
    calls.push({ url: urlStr, init });
    const m = responses.shift();
    if (!m) throw new Error(`stub fetcher: no response queued for ${urlStr}`);
    if (!urlStr.startsWith(m.url)) {
      throw new Error(`stub fetcher: expected ${m.url}, got ${urlStr}`);
    }
    return new Response(JSON.stringify(m.body), {
      status: m.status,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;
  return {
    fetcher,
    queue: (url: string, status: number, body: unknown) => {
      responses.push({ url, status, body });
    },
    calls,
  };
}

const SAMPLE_CLAIMS: LinkedinUserInfo = {
  sub: "linkedin-sub-12345",
  name: "Maya Patel",
  given_name: "Maya",
  family_name: "Patel",
  email: "maya@stripe.com",
  email_verified: true,
  picture: "https://media.licdn.com/dms/image/abcd1234.jpg",
  locale: "en_US",
};

// -- State token primitive ----------------------------------------------------

describe("state token sign/verify", () => {
  it("signs and verifies a fresh token round-trip", () => {
    const { token, nonce, expiresAt } = signStateToken("maya@gmail.com", HMAC_SECRET);
    expect(typeof token).toBe("string");
    expect(token).toMatch(/\./); // has body.sig
    const v = verifyStateToken(token, HMAC_SECRET);
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.payload.e).toBe("maya@gmail.com");
      expect(v.payload.n).toBe(nonce);
      expect(v.payload.x).toBe(expiresAt);
    }
  });

  it("lowercases the email claim", () => {
    const { token } = signStateToken("Maya@Gmail.com", HMAC_SECRET);
    const v = verifyStateToken(token, HMAC_SECRET);
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.payload.e).toBe("maya@gmail.com");
  });

  it("rejects a token signed with a different secret", () => {
    const { token } = signStateToken("maya@gmail.com", HMAC_SECRET);
    const v = verifyStateToken(token, "different-secret");
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("bad_signature");
  });

  it("rejects a tampered payload", () => {
    const { token } = signStateToken("maya@gmail.com", HMAC_SECRET);
    const [body, sig] = token.split(".");
    // Flip the last char of the body
    const tampered = body!.slice(0, -1) + (body!.at(-1) === "A" ? "B" : "A") + "." + sig;
    const v = verifyStateToken(tampered, HMAC_SECRET);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("bad_signature");
  });

  it("rejects an expired token", () => {
    const past = Date.now() - STATE_TTL_MS - 1000;
    const { token } = signStateToken("maya@gmail.com", HMAC_SECRET, past);
    const v = verifyStateToken(token, HMAC_SECRET);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("expired");
  });

  it("rejects malformed tokens", () => {
    const v1 = verifyStateToken("not-a-token", HMAC_SECRET);
    expect(v1.ok).toBe(false);
    const v2 = verifyStateToken("missingdot", HMAC_SECRET);
    expect(v2.ok).toBe(false);
  });
});

// -- Bucket projection --------------------------------------------------------

describe("projectUserInfo (two-bucket model)", () => {
  it("maps OIDC claims to visible + context buckets", () => {
    const id = projectUserInfo("Maya@Gmail.com", SAMPLE_CLAIMS);
    expect(id.email).toBe("maya@gmail.com");
    // Bucket A: visible + editable
    expect(id.visible.name).toBe("Maya Patel");
    expect(id.visible.givenName).toBe("Maya");
    expect(id.visible.familyName).toBe("Patel");
    expect(id.visible.pictureUrl).toBe("https://media.licdn.com/dms/image/abcd1234.jpg");
    expect(id.visible.email).toBe("maya@stripe.com");
    // Bucket B: context + hidden
    expect(id.context.sub).toBe("linkedin-sub-12345");
    expect(id.context.emailVerified).toBe(true);
    expect(id.context.locale).toBe("en_US");
    // Derived fields — the cold-start signals.
    expect(id.context.emailDomain).toBe("stripe.com");
    expect(id.context.pictureCdnHost).toBe("media.licdn.com");
    // Raw claims preserved for re-derivation in v2.
    expect(id.context.rawClaims).toMatchObject(SAMPLE_CLAIMS);
    expect(typeof id.context.connectedAt).toBe("number");
    expect(id.context.refreshedAt).toBe(id.context.connectedAt);
  });

  it("tolerates missing optional claims", () => {
    const id = projectUserInfo("oz@gmail.com", { sub: "x" });
    expect(id.visible.name).toBe("");
    expect(id.context.sub).toBe("x");
    expect(id.context.emailDomain).toBeUndefined();
    expect(id.context.pictureCdnHost).toBeUndefined();
  });

  it("ignores an unparseable picture URL", () => {
    const id = projectUserInfo("oz@gmail.com", {
      sub: "x",
      picture: "not a url",
    });
    expect(id.context.pictureCdnHost).toBeUndefined();
  });
});

// -- Nonce tracker ------------------------------------------------------------

describe("inMemoryNonceTracker", () => {
  it("returns 'fresh' for an unseen nonce and 'replay' on the second call", () => {
    const t = inMemoryNonceTracker();
    const exp = Date.now() + 60_000;
    expect(t.consume("nonce-1", exp)).toBe("fresh");
    expect(t.consume("nonce-1", exp)).toBe("replay");
    expect(t.consume("nonce-2", exp)).toBe("fresh");
    expect(t.size()).toBe(2);
  });

  it("prunes expired entries", () => {
    const t = inMemoryNonceTracker();
    t.consume("expired-1", Date.now() - 1000);
    // Force prune by consuming another nonce
    t.consume("fresh-1", Date.now() + 60_000);
    expect(t.size()).toBe(1); // only fresh-1
  });
});

// -- Route-level: disabled mode -----------------------------------------------

describe("LinkedIn integration disabled", () => {
  let store: Store;
  let app: ReturnType<typeof createApp>;
  beforeEach(() => {
    store = createStore();
    app = createApp({ store, demoTrustHeader: true });
  });
  afterEach(() => store.reset());

  it("config returns enabled=false", async () => {
    const r = await request(app).get("/v1/social/me/linkedin/config");
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ enabled: false });
  });

  it("start refuses with 503", async () => {
    await request(app).get("/v1/social/me").set(userHeaders("maya@gmail.com"));
    const r = await request(app)
      .post("/v1/social/me/linkedin/start")
      .set(userHeaders("maya@gmail.com"));
    expect(r.status).toBe(503);
  });

  it("callback refuses with 503", async () => {
    const r = await request(app).get("/v1/social/me/linkedin/callback");
    expect(r.status).toBe(503);
  });
});

// -- Route-level: enabled mode ------------------------------------------------

describe("LinkedIn integration enabled", () => {
  let store: Store;
  let app: ReturnType<typeof createApp>;
  let stub: ReturnType<typeof makeStubFetcher>;
  let nonces: NonceTracker;

  beforeEach(() => {
    store = createStore();
    stub = makeStubFetcher();
    nonces = inMemoryNonceTracker();
    app = createApp({
      store,
      demoTrustHeader: true,
      jwtSecret: HMAC_SECRET,
      linkedin: {
        clientId: "test-client-id",
        clientSecret: "test-client-secret",
        redirectUri: "https://learnai.test/v1/social/me/linkedin/callback",
        hmacSecret: HMAC_SECRET,
        fetcher: stub.fetcher,
      },
      linkedinNonceTracker: nonces,
      appOrigin: "https://learnai.test",
    });
  });
  afterEach(() => store.reset());

  it("config returns enabled=true", async () => {
    const r = await request(app).get("/v1/social/me/linkedin/config");
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ enabled: true });
  });

  it("start is auth-gated", async () => {
    const r = await request(app).post("/v1/social/me/linkedin/start");
    expect(r.status).toBe(401);
  });

  it("start returns an authorize URL with a signed state token", async () => {
    await request(app).get("/v1/social/me").set(userHeaders("maya@gmail.com"));
    const r = await request(app)
      .post("/v1/social/me/linkedin/start")
      .set(userHeaders("maya@gmail.com"));
    expect(r.status).toBe(200);
    expect(r.body.url).toMatch(/^https:\/\/www\.linkedin\.com\/oauth\/v2\/authorization\?/);
    const u = new URL(r.body.url);
    expect(u.searchParams.get("client_id")).toBe("test-client-id");
    expect(u.searchParams.get("redirect_uri")).toBe(
      "https://learnai.test/v1/social/me/linkedin/callback",
    );
    expect(u.searchParams.get("scope")).toBe("openid profile email");
    const state = u.searchParams.get("state")!;
    const v = verifyStateToken(state, HMAC_SECRET);
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.payload.e).toBe("maya@gmail.com");
  });

  it("callback rejects missing code+state with 400", async () => {
    const r = await request(app).get("/v1/social/me/linkedin/callback");
    expect(r.status).toBe(400);
  });

  it("callback rejects an invalid state token", async () => {
    const r = await request(app)
      .get("/v1/social/me/linkedin/callback")
      .query({ code: "abc", state: "bogus.token" });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe("invalid_state");
  });

  it("callback rejects a replayed state token", async () => {
    await request(app).get("/v1/social/me").set(userHeaders("maya@gmail.com"));
    const { token } = signStateToken("maya@gmail.com", HMAC_SECRET);
    // First use: token + userinfo stubs queued, callback should succeed
    stub.queue("https://www.linkedin.com/oauth/v2/accessToken", 200, {
      access_token: "t1",
    });
    stub.queue("https://api.linkedin.com/v2/userinfo", 200, SAMPLE_CLAIMS);
    const ok = await request(app)
      .get("/v1/social/me/linkedin/callback")
      .query({ code: "code-1", state: token });
    expect(ok.status).toBe(302);
    // Second use of the same token should be detected as replay
    const replay = await request(app)
      .get("/v1/social/me/linkedin/callback")
      .query({ code: "code-2", state: token });
    expect(replay.status).toBe(400);
    expect(replay.body.error).toBe("state_replayed");
  });

  it("callback redirects with ?linkedin=error on OAuth-side error", async () => {
    const r = await request(app)
      .get("/v1/social/me/linkedin/callback")
      .query({ error: "user_denied" });
    expect(r.status).toBe(302);
    expect(r.headers.location).toBe(
      "https://learnai.test/network?linkedin=error&reason=user_denied",
    );
  });

  it("callback happy path: exchanges code, fetches userinfo, stores both buckets, redirects", async () => {
    await request(app).get("/v1/social/me").set(userHeaders("maya@gmail.com"));
    const { token } = signStateToken("maya@gmail.com", HMAC_SECRET);
    stub.queue("https://www.linkedin.com/oauth/v2/accessToken", 200, {
      access_token: "good-token",
      expires_in: 3600,
    });
    stub.queue("https://api.linkedin.com/v2/userinfo", 200, SAMPLE_CLAIMS);

    const r = await request(app)
      .get("/v1/social/me/linkedin/callback")
      .query({ code: "auth-code-xyz", state: token });
    expect(r.status).toBe(302);
    expect(r.headers.location).toBe("https://learnai.test/network?linkedin=connected");

    // Confirm the token endpoint got the right params
    const tokenCall = stub.calls[0]!;
    expect(tokenCall.url).toBe("https://www.linkedin.com/oauth/v2/accessToken");
    const body = String(tokenCall.init?.body ?? "");
    expect(body).toContain("code=auth-code-xyz");
    expect(body).toContain("client_id=test-client-id");
    expect(body).toContain("client_secret=test-client-secret");

    // Confirm userinfo got the bearer token
    const userinfoCall = stub.calls[1]!;
    const headers = userinfoCall.init?.headers as Record<string, string>;
    expect(headers.authorization).toBe("Bearer good-token");

    // Confirm both buckets stored
    const stored = store.getLinkedinIdentity("maya@gmail.com");
    expect(stored).toBeTruthy();
    expect(stored!.visible.name).toBe("Maya Patel");
    expect(stored!.context.sub).toBe("linkedin-sub-12345");
    expect(stored!.context.emailDomain).toBe("stripe.com");
  });

  it("callback dedup: rejects when sub is already linked to a different email", async () => {
    // Pre-seed an identity for oz@gmail.com with the same sub
    await request(app).get("/v1/social/me").set(userHeaders("oz@gmail.com"));
    store.upsertLinkedinIdentity({
      email: "oz@gmail.com",
      visible: { name: "Oz" },
      context: { sub: SAMPLE_CLAIMS.sub, connectedAt: Date.now(), refreshedAt: Date.now() },
    });
    // Maya tries to connect the same LinkedIn
    await request(app).get("/v1/social/me").set(userHeaders("maya@gmail.com"));
    const { token } = signStateToken("maya@gmail.com", HMAC_SECRET);
    stub.queue("https://www.linkedin.com/oauth/v2/accessToken", 200, {
      access_token: "t",
    });
    stub.queue("https://api.linkedin.com/v2/userinfo", 200, SAMPLE_CLAIMS);
    const r = await request(app)
      .get("/v1/social/me/linkedin/callback")
      .query({ code: "c", state: token });
    expect(r.status).toBe(302);
    expect(r.headers.location).toBe(
      "https://learnai.test/network?linkedin=error&reason=already_linked",
    );
    // Maya's identity should NOT be created
    expect(store.getLinkedinIdentity("maya@gmail.com")).toBeNull();
    // Oz's identity should still be there
    expect(store.getLinkedinIdentity("oz@gmail.com")).toBeTruthy();
  });

  it("callback succeeds when the same email reconnects (refresh)", async () => {
    await request(app).get("/v1/social/me").set(userHeaders("maya@gmail.com"));
    const firstConnectedAt = Date.now() - 60_000;
    store.upsertLinkedinIdentity({
      email: "maya@gmail.com",
      visible: { name: "Old Name" },
      context: {
        sub: SAMPLE_CLAIMS.sub,
        connectedAt: firstConnectedAt,
        refreshedAt: firstConnectedAt,
      },
    });
    const { token } = signStateToken("maya@gmail.com", HMAC_SECRET);
    stub.queue("https://www.linkedin.com/oauth/v2/accessToken", 200, {
      access_token: "t",
    });
    stub.queue("https://api.linkedin.com/v2/userinfo", 200, SAMPLE_CLAIMS);
    const r = await request(app)
      .get("/v1/social/me/linkedin/callback")
      .query({ code: "c", state: token });
    expect(r.status).toBe(302);
    const stored = store.getLinkedinIdentity("maya@gmail.com");
    expect(stored!.visible.name).toBe("Maya Patel");
    expect(stored!.context.refreshedAt).toBeGreaterThan(firstConnectedAt);
  });

  it("callback redirects with exchange_failed when LinkedIn token endpoint errors", async () => {
    await request(app).get("/v1/social/me").set(userHeaders("maya@gmail.com"));
    const { token } = signStateToken("maya@gmail.com", HMAC_SECRET);
    stub.queue("https://www.linkedin.com/oauth/v2/accessToken", 401, {
      error: "invalid_grant",
    });
    const r = await request(app)
      .get("/v1/social/me/linkedin/callback")
      .query({ code: "c", state: token });
    expect(r.status).toBe(302);
    expect(r.headers.location).toBe(
      "https://learnai.test/network?linkedin=error&reason=exchange_failed",
    );
    expect(store.getLinkedinIdentity("maya@gmail.com")).toBeNull();
  });

  it("GET /me/linkedin returns connected:false when nothing stored", async () => {
    await request(app).get("/v1/social/me").set(userHeaders("maya@gmail.com"));
    const r = await request(app)
      .get("/v1/social/me/linkedin")
      .set(userHeaders("maya@gmail.com"));
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ connected: false });
  });

  it("GET /me/linkedin returns the stored identity when connected", async () => {
    await request(app).get("/v1/social/me").set(userHeaders("maya@gmail.com"));
    store.upsertLinkedinIdentity(projectUserInfo("maya@gmail.com", SAMPLE_CLAIMS));
    const r = await request(app)
      .get("/v1/social/me/linkedin")
      .set(userHeaders("maya@gmail.com"));
    expect(r.status).toBe(200);
    expect(r.body.connected).toBe(true);
    expect(r.body.identity.visible.name).toBe("Maya Patel");
    expect(r.body.identity.context.emailDomain).toBe("stripe.com");
  });

  it("DELETE /me/linkedin clears both buckets", async () => {
    await request(app).get("/v1/social/me").set(userHeaders("maya@gmail.com"));
    store.upsertLinkedinIdentity(projectUserInfo("maya@gmail.com", SAMPLE_CLAIMS));
    const r = await request(app)
      .delete("/v1/social/me/linkedin")
      .set(userHeaders("maya@gmail.com"));
    expect(r.status).toBe(200);
    expect(r.body.removed).toBe(true);
    expect(store.getLinkedinIdentity("maya@gmail.com")).toBeNull();
  });

  it("GET /me/linkedin scopes to the caller (no cross-account read)", async () => {
    await request(app).get("/v1/social/me").set(userHeaders("maya@gmail.com"));
    await request(app).get("/v1/social/me").set(userHeaders("oz@gmail.com"));
    store.upsertLinkedinIdentity(projectUserInfo("maya@gmail.com", SAMPLE_CLAIMS));
    const r = await request(app)
      .get("/v1/social/me/linkedin")
      .set(userHeaders("oz@gmail.com"));
    expect(r.body).toEqual({ connected: false });
  });
});

// -- Cascade delete -----------------------------------------------------------

describe("cascade delete", () => {
  it("removes the LinkedIn identity when the profile is deleted", () => {
    const store = createStore();
    store.upsertProfile({
      email: "maya@gmail.com",
      handle: "maya",
      displayFirst: "Maya",
      ageBand: "adult",
      profileMode: "open",
      showFullName: true,
      showCurrent: true,
      showMap: true,
      showActivity: true,
      showBadges: true,
      showSignup: true,
      signalsGlobal: true,
      signals: [],
      banned: false,
      bannedSocial: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    store.upsertLinkedinIdentity(projectUserInfo("maya@gmail.com", SAMPLE_CLAIMS));
    expect(store.getLinkedinIdentity("maya@gmail.com")).toBeTruthy();
    expect(store.deleteProfileCascade("maya@gmail.com")).toBe(true);
    expect(store.getLinkedinIdentity("maya@gmail.com")).toBeNull();
  });
});
