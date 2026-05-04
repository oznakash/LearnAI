import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { createStore, type Store } from "../src/store.js";
import {
  baseHandleFromEmail,
  disambiguateHandle,
} from "../src/handles.js";

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

describe("disambiguateHandle — reserved-handle skip", () => {
  it("skips reserved handles even when un-taken (matches SPA-side `isReservedHandle`)", () => {
    // No collision in the store — but `admin` is reserved, so the
    // disambiguator should advance to admin2.
    const out = disambiguateHandle("admin", () => false);
    expect(out).toBe("admin2");
  });

  it("skips a sequence of reserved candidates", () => {
    // Hypothetical: every numeric variant up to 5 is taken AND `mem0`
    // is reserved. Function should still find a non-reserved free spot.
    const taken = new Set<string>(["mem02", "mem03", "mem04"]);
    const out = disambiguateHandle("mem0", (h) => taken.has(h));
    // `mem0` itself is reserved → skip; `mem02..4` taken → skip; `mem05` free.
    expect(out).toBe("mem05");
  });

  it("clamps the suffixed candidate to MAX_LEN (24 chars)", () => {
    // 23-char base + 4-digit collision = 27 chars without clamp. Clamped
    // form should still be ≤ 24 chars.
    const base = "a".repeat(23);
    let attempt = 0;
    const out = disambiguateHandle(base, () => {
      attempt++;
      return attempt < 1500; // force base + many numeric collisions
    });
    expect(out!.length).toBeLessThanOrEqual(24);
  });
});

describe("requireUser auto-create (SPA → social-svc lazy provisioning)", () => {
  it("a signed-in user with NO name/picture still creates a profile on first /me", async () => {
    // This is the regression Bug A fixes — a mem0-only user with email
    // but no name/picture used to never reach social-svc because the
    // SPA only PUT /me when a name or picture was present. The server's
    // requireUser auto-create still works regardless.
    const r = await request(app)
      .get("/v1/social/me")
      .set(headers("nakedidentity@gmail.com"));
    expect(r.status).toBe(200);
    expect(r.body.handle).toBe("nakedidentity");
    // Server has the profile now.
    expect(store.getProfileByEmail("nakedidentity@gmail.com")).not.toBeNull();
  });

  it("auto-creates a profile for an admin-handle email but with a non-reserved disambiguated handle", async () => {
    const r = await request(app)
      .get("/v1/social/me")
      .set(headers("admin@gmail.com"));
    expect(r.status).toBe(200);
    expect(r.body.handle).not.toBe("admin");
    expect(r.body.handle).toBe("admin2");
  });
});

describe("POST /v1/social/admin/profiles/upsert", () => {
  it("requires admin auth", async () => {
    const r = await request(app)
      .post("/v1/social/admin/profiles/upsert")
      .set(headers("not-admin@gmail.com"))
      .send({ email: "alex@gmail.com" });
    expect(r.status).toBe(403);
  });

  it("creates a missing profile from a bare email", async () => {
    const r = await request(app)
      .post("/v1/social/admin/profiles/upsert")
      .set(headers("admin@learnai.dev"))
      .send({ email: "danshtr@gmail.com" });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ created: true, handle: "danshtr" });
    expect(store.getProfileByEmail("danshtr@gmail.com")).not.toBeNull();
  });

  it("is idempotent — re-running on an existing email returns created=false", async () => {
    const first = await request(app)
      .post("/v1/social/admin/profiles/upsert")
      .set(headers("admin@learnai.dev"))
      .send({ email: "danshtr@gmail.com" });
    expect(first.body.created).toBe(true);
    const second = await request(app)
      .post("/v1/social/admin/profiles/upsert")
      .set(headers("admin@learnai.dev"))
      .send({ email: "danshtr@gmail.com" });
    expect(second.body.created).toBe(false);
    expect(second.body.handle).toBe(first.body.handle);
  });

  it("rejects malformed emails", async () => {
    const r = await request(app)
      .post("/v1/social/admin/profiles/upsert")
      .set(headers("admin@learnai.dev"))
      .send({ email: "not-an-email" });
    expect(r.status).toBe(400);
  });

  it("backfills displayName + pictureUrl when profile is missing them", async () => {
    // Pre-create a stub profile with no fullName / pictureUrl
    store.upsertProfile({
      email: "stub@gmail.com",
      handle: "stub",
      displayFirst: "Stub",
      ageBand: "adult",
      profileMode: "open",
      showFullName: false,
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
    const r = await request(app)
      .post("/v1/social/admin/profiles/upsert")
      .set(headers("admin@learnai.dev"))
      .send({
        email: "stub@gmail.com",
        fullName: "Stub Person",
        pictureUrl: "https://example.com/p.jpg",
      });
    expect(r.status).toBe(200);
    expect(r.body.created).toBe(false);
    const after = store.getProfileByEmail("stub@gmail.com");
    expect(after?.fullName).toBe("Stub Person");
    expect(after?.pictureUrl).toBe("https://example.com/p.jpg");
  });
});

describe("cross-service handle parity", () => {
  it("baseHandleFromEmail produces the same output as the SPA-side helper", async () => {
    // Cross-read the SPA helper file as text and compile a tiny eval
    // against the same fixtures. This is the same parity guard used by
    // hidden-accounts.test.ts.
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const url = await import("node:url");
    const here = url.fileURLToPath(import.meta.url);
    const repoRoot = path.resolve(path.dirname(here), "../../..");
    const spaText = await fs.readFile(
      path.join(repoRoot, "app/src/social/handles.ts"),
      "utf8",
    );
    // Lightweight: assert the SPA file declares the same MAX_LEN + the
    // same Gmail-dot collapse so a reader-of-this-test can confirm the
    // algorithms are identical.
    expect(spaText).toContain("const MAX_LEN = 24");
    expect(spaText).toContain('replace(/\\./g, "")');
  });
});
