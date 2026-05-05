import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { createStore, type Store } from "../src/store.js";
import {
  isHiddenAccount,
  listHiddenAccountEmails,
} from "../src/hidden-accounts.js";

const HIDDEN = "learnai-qa+maya@gmail.com";
const HIDDEN_HANDLE_BASE = "learnai-qa-maya"; // baseHandleFromEmail collapses `+` to `-`
const REAL = "alex@gmail.com";
const REAL2 = "priya@gmail.com";

let store: Store;
let app: ReturnType<typeof createApp>;

beforeEach(() => {
  store = createStore();
  app = createApp({
    store,
    admins: ["admin@learnai.dev"],
    demoTrustHeader: true,
  });
});

afterEach(() => {
  store.reset();
});

const headers = (email: string) => ({ "x-user-email": email });

async function signUp(email: string) {
  const r = await request(app).get("/v1/social/me").set(headers(email));
  expect(r.status).toBe(200);
  return r.body as { handle: string };
}

describe("hidden-accounts allowlist", () => {
  it("isHiddenAccount + listHiddenAccountEmails describe a non-empty set", () => {
    expect(listHiddenAccountEmails().length).toBeGreaterThan(0);
    for (const email of listHiddenAccountEmails()) {
      expect(isHiddenAccount(email)).toBe(true);
    }
    expect(isHiddenAccount("alex@gmail.com")).toBe(false);
    expect(isHiddenAccount(undefined)).toBe(false);
    expect(isHiddenAccount("")).toBe(false);
  });

  it("matches the SPA allowlist (same emails on both sides)", async () => {
    // Vitest doesn't know how to import from outside the social-svc
    // package, so we read the SPA file as text and assert both lists
    // mention the same two canonical emails. The set is small enough
    // that this stays clear on diff.
    const fs = await import("node:fs/promises");
    const url = await import("node:url");
    const here = url.fileURLToPath(import.meta.url);
    const path = await import("node:path");
    const repoRoot = path.resolve(path.dirname(here), "../../..");
    const spaText = await fs.readFile(
      path.join(repoRoot, "app/src/lib/hidden-accounts.ts"),
      "utf8",
    );
    for (const email of listHiddenAccountEmails()) {
      expect(spaText, `SPA allowlist must include ${email}`).toContain(email);
    }
  });

  it("hidden-handles list filters smoke-test artifacts (auth-cascade)", async () => {
    const { isHiddenHandle, isHiddenProfile, listHiddenHandles } = await import(
      "../src/hidden-accounts.js"
    );
    expect(listHiddenHandles().length).toBeGreaterThan(0);
    expect(isHiddenHandle("auth-cascade")).toBe(true);
    expect(isHiddenHandle("AUTH-CASCADE")).toBe(true); // case-insensitive
    expect(isHiddenHandle("oznakash")).toBe(false);
    expect(isHiddenHandle(undefined)).toBe(false);
    // isHiddenProfile combines both checks.
    expect(isHiddenProfile({ handle: "auth-cascade", email: "x@y.com" })).toBe(true);
    expect(isHiddenProfile({ handle: "oznakash", email: HIDDEN })).toBe(true);
    expect(isHiddenProfile({ handle: "oznakash", email: "x@y.com" })).toBe(false);
    expect(isHiddenProfile(null)).toBe(false);
  });

  it("SPA mirror also carries the explicit hidden handles (auth-cascade)", async () => {
    const fs = await import("node:fs/promises");
    const url = await import("node:url");
    const here = url.fileURLToPath(import.meta.url);
    const path = await import("node:path");
    const repoRoot = path.resolve(path.dirname(here), "../../..");
    const spaText = await fs.readFile(
      path.join(repoRoot, "app/src/lib/hidden-accounts.ts"),
      "utf8",
    );
    const { listHiddenHandles } = await import("../src/hidden-accounts.js");
    for (const handle of listHiddenHandles()) {
      expect(spaText, `SPA hidden-handles must include ${handle}`).toContain(handle);
    }
  });
});

describe("/u/:handle SSR", () => {
  it("returns 404 when the handle resolves to a hidden persona, even though the profile exists", async () => {
    await signUp(HIDDEN);
    const r = await request(app).get(`/u/${HIDDEN_HANDLE_BASE}`);
    expect(r.status).toBe(404);
    // Should not leak the profile's display name into the not-found body.
    expect(r.text).not.toContain("Maya");
  });

  it("renders normally for a real user", async () => {
    const real = await signUp(REAL);
    const r = await request(app).get(`/u/${real.handle}`);
    expect(r.status).toBe(200);
  });
});

describe("/sitemap.xml", () => {
  it("excludes hidden personas while keeping real users", async () => {
    await signUp(HIDDEN);
    const real = await signUp(REAL);
    const r = await request(app).get("/sitemap.xml");
    expect(r.status).toBe(200);
    expect(r.text).toContain(`/u/${real.handle}`);
    expect(r.text).not.toContain(`/u/${HIDDEN_HANDLE_BASE}`);
  });
});

describe("GET /v1/social/profiles/:handle", () => {
  it("returns 404 when a non-owner viewer asks for a hidden profile", async () => {
    await signUp(HIDDEN);
    await signUp(REAL);
    const r = await request(app)
      .get(`/v1/social/profiles/${HIDDEN_HANDLE_BASE}`)
      .set(headers(REAL));
    expect(r.status).toBe(404);
  });

  it("still returns the full profile to the owner (so the FTUE owner-view works)", async () => {
    await signUp(HIDDEN);
    const r = await request(app)
      .get(`/v1/social/profiles/${HIDDEN_HANDLE_BASE}`)
      .set(headers(HIDDEN));
    expect(r.status).toBe(200);
    expect(r.body.handle).toBe(HIDDEN_HANDLE_BASE);
  });

  it("returns real profiles to real viewers (no over-filtering)", async () => {
    const real = await signUp(REAL);
    await signUp(REAL2);
    const r = await request(app)
      .get(`/v1/social/profiles/${real.handle}`)
      .set(headers(REAL2));
    expect(r.status).toBe(200);
    expect(r.body.handle).toBe(real.handle);
  });
});

describe("GET /v1/social/boards/:scope", () => {
  async function publishOpenProfile(email: string) {
    const me = await signUp(email);
    // Snapshot a baseline aggregate so the user qualifies as a board candidate.
    await request(app)
      .post("/v1/social/me/snapshot")
      .set(headers(email))
      .send({
        guildTier: "Builder",
        streak: 1,
        xpTotal: 100,
        signals: ["ai-pm"],
        badges: [],
      });
    return me;
  }

  it("excludes hidden personas from the global board", async () => {
    await publishOpenProfile(HIDDEN);
    const real = await publishOpenProfile(REAL);
    const r = await request(app)
      .get("/v1/social/boards/global")
      .set(headers(REAL2));
    expect(r.status).toBe(200);
    const handles = (r.body as { handle: string }[]).map((p) => p.handle);
    expect(handles).toContain(real.handle);
    expect(handles).not.toContain(HIDDEN_HANDLE_BASE);
  });
});

describe("GET /v1/social/stream", () => {
  it("excludes events authored by hidden personas", async () => {
    await signUp(HIDDEN);
    const real = await signUp(REAL);
    // Hidden persona produces a spotlight event.
    store.insertEvent({
      email: HIDDEN,
      kind: "spotlight",
      topicId: "ai-pm",
      level: 2,
      detail: "Cleared L2",
      createdAt: Date.now(),
    });
    // Real user produces one too.
    store.insertEvent({
      email: REAL,
      kind: "spotlight",
      topicId: "ai-pm",
      level: 2,
      detail: "Cleared L2",
      createdAt: Date.now(),
    });
    // A different real viewer queries the stream.
    await signUp(REAL2);
    const r = await request(app)
      .get("/v1/social/stream")
      .set(headers(REAL2));
    expect(r.status).toBe(200);
    const handles = (r.body as { authorHandle: string }[]).map(
      (c) => c.authorHandle,
    );
    expect(handles).toContain(real.handle);
    expect(handles).not.toContain(HIDDEN_HANDLE_BASE);
  });
});
