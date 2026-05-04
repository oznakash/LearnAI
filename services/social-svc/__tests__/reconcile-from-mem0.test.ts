import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { createStore, type Store } from "../src/store.js";

/**
 * /v1/social/admin/reconcile-from-mem0 — the recurring guarantee that
 * every mem0 user has a social-svc profile.
 *
 * Pre-fix behavior (entity-wiring audit): when a mem0 user existed
 * but never hit a social-svc endpoint, they were a "ghost" — no
 * profile, no leaderboard row, no /u/<handle> page. The audit found
 * 6 such stranded users.
 *
 * This endpoint pulls mem0's user list and idempotently upserts a
 * social-svc profile for each. Designed to be run by a cron / schedule
 * so future stranding self-heals automatically. The admin gate is the
 * standard one; mem0 credentials are passed per-request in the body
 * so social-svc itself doesn't carry them.
 */

let store: Store;
let app: ReturnType<typeof createApp>;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  store = createStore();
  app = createApp({
    store,
    admins: ["admin@learnai.dev"],
    demoTrustHeader: true,
  });
  // Replace global fetch for the duration of the test so we never
  // make a real HTTP request to a fake mem0Url.
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  store.reset();
  vi.unstubAllGlobals();
});

const headers = (email: string) => ({ "x-user-email": email });

type StateRow = {
  email: string;
  display_name?: string | null;
  picture_url?: string | null;
};

function memUserStateResponse(rows: StateRow[]) {
  return { recent: rows };
}

function memAuthUsersResponse(rows: { email: string; name?: string }[]) {
  return { users: rows };
}

function mockMem0(
  stateRows: StateRow[] | string[],
  authRows: { email: string; name?: string }[] = [],
) {
  // Backwards-compatible: a string[] is treated as bare emails.
  const normalized: StateRow[] = stateRows.map((r) =>
    typeof r === "string" ? { email: r } : r,
  );
  fetchMock.mockImplementation(async (url: string) => {
    if (url.endsWith("/v1/state/admin/users")) {
      return new Response(JSON.stringify(memUserStateResponse(normalized)), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    if (url.endsWith("/auth/admin/users")) {
      return new Response(JSON.stringify(memAuthUsersResponse(authRows)), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response("not found", { status: 404 });
  });
}

describe("POST /v1/social/admin/reconcile-from-mem0", () => {
  it("requires admin auth", async () => {
    const r = await request(app)
      .post("/v1/social/admin/reconcile-from-mem0")
      .set(headers("not-admin@gmail.com"))
      .send({ mem0Url: "https://m0", mem0AdminApiKey: "k" });
    expect(r.status).toBe(403);
  });

  it("rejects when mem0Url or key is missing", async () => {
    const r = await request(app)
      .post("/v1/social/admin/reconcile-from-mem0")
      .set(headers("admin@learnai.dev"))
      .send({});
    expect(r.status).toBe(400);
  });

  it("creates profiles for every mem0 user that doesn't yet exist in social-svc", async () => {
    mockMem0(["alpha@gmail.com", "beta@gmail.com", "gamma@gmail.com"]);

    const r = await request(app)
      .post("/v1/social/admin/reconcile-from-mem0")
      .set(headers("admin@learnai.dev"))
      .send({ mem0Url: "https://m0", mem0AdminApiKey: "k" });
    expect(r.status).toBe(200);
    expect(r.body.mem0UserCount).toBe(3);
    expect(r.body.created.sort()).toEqual([
      "alpha@gmail.com",
      "beta@gmail.com",
      "gamma@gmail.com",
    ]);
    expect(store.getProfileByEmail("alpha@gmail.com")).not.toBeNull();
    expect(store.getProfileByEmail("beta@gmail.com")).not.toBeNull();
    expect(store.getProfileByEmail("gamma@gmail.com")).not.toBeNull();
  });

  it("is idempotent — re-running on a fully-synced mem0 returns 0 created", async () => {
    mockMem0(["alpha@gmail.com"]);
    const first = await request(app)
      .post("/v1/social/admin/reconcile-from-mem0")
      .set(headers("admin@learnai.dev"))
      .send({ mem0Url: "https://m0", mem0AdminApiKey: "k" });
    expect(first.body.created.length).toBe(1);
    const second = await request(app)
      .post("/v1/social/admin/reconcile-from-mem0")
      .set(headers("admin@learnai.dev"))
      .send({ mem0Url: "https://m0", mem0AdminApiKey: "k" });
    expect(second.body.created.length).toBe(0);
    expect(second.body.skipped.length).toBe(1);
  });

  it("merges fullName from /auth/admin/users into newly-created profiles", async () => {
    mockMem0(
      ["password-user@gmail.com"],
      [{ email: "password-user@gmail.com", name: "Cho Chang" }],
    );
    await request(app)
      .post("/v1/social/admin/reconcile-from-mem0")
      .set(headers("admin@learnai.dev"))
      .send({ mem0Url: "https://m0", mem0AdminApiKey: "k" });
    const profile = store.getProfileByEmail("password-user@gmail.com");
    expect(profile?.fullName).toBe("Cho Chang");
  });

  it("Google-only users (no /auth/admin/users row) get a profile but no fullName", async () => {
    mockMem0(["google-user@gmail.com"]);
    await request(app)
      .post("/v1/social/admin/reconcile-from-mem0")
      .set(headers("admin@learnai.dev"))
      .send({ mem0Url: "https://m0", mem0AdminApiKey: "k" });
    const profile = store.getProfileByEmail("google-user@gmail.com");
    expect(profile).not.toBeNull();
    expect(profile?.fullName).toBeUndefined();
  });

  it("a flaky mem0 returns an error report instead of a 5xx", async () => {
    fetchMock.mockResolvedValue(
      new Response("internal", { status: 503 }),
    );
    const r = await request(app)
      .post("/v1/social/admin/reconcile-from-mem0")
      .set(headers("admin@learnai.dev"))
      .send({ mem0Url: "https://m0", mem0AdminApiKey: "k" });
    // Endpoint returns 200 with an empty result rather than letting
    // the failure cascade — a /schedule cron should keep going.
    expect(r.status).toBe(200);
    expect(r.body.mem0UserCount).toBe(0);
    expect(r.body.created.length).toBe(0);
  });

  // -- Identity propagation from user_state (post-mem0#21) ----------------
  // The mem0 PR #21 added persistent display_name + picture_url columns
  // to user_states, populated on every /auth/google signin. Reconcile
  // should pick them up so a Google user lands on social-svc with their
  // real name + avatar (not just title-cased handle) without the SPA
  // ever needing to do anything.

  it("uses display_name from user_state to fill fullName for Google users", async () => {
    mockMem0([
      { email: "google-user@gmail.com", display_name: "Cho Chang" },
    ]);
    await request(app)
      .post("/v1/social/admin/reconcile-from-mem0")
      .set(headers("admin@learnai.dev"))
      .send({ mem0Url: "https://m0", mem0AdminApiKey: "k" });
    const profile = store.getProfileByEmail("google-user@gmail.com");
    expect(profile?.fullName).toBe("Cho Chang");
  });

  it("uses picture_url from user_state to fill pictureUrl for Google users", async () => {
    mockMem0([
      {
        email: "google-user@gmail.com",
        display_name: "Cho Chang",
        picture_url: "https://lh3.googleusercontent.com/cho/avatar.jpg",
      },
    ]);
    await request(app)
      .post("/v1/social/admin/reconcile-from-mem0")
      .set(headers("admin@learnai.dev"))
      .send({ mem0Url: "https://m0", mem0AdminApiKey: "k" });
    const profile = store.getProfileByEmail("google-user@gmail.com");
    expect(profile?.pictureUrl).toBe(
      "https://lh3.googleusercontent.com/cho/avatar.jpg",
    );
  });

  it("user_state.display_name wins over auth.users.name when both are present", async () => {
    // Hypothetical: a user signed up via password long ago (auth.users
    // has their stale name) and later switched to Google signin
    // (user_state has the fresh Google name). The Google name is more
    // current — primary source wins.
    mockMem0(
      [{ email: "user@gmail.com", display_name: "New Google Name" }],
      [{ email: "user@gmail.com", name: "Old Password Name" }],
    );
    await request(app)
      .post("/v1/social/admin/reconcile-from-mem0")
      .set(headers("admin@learnai.dev"))
      .send({ mem0Url: "https://m0", mem0AdminApiKey: "k" });
    const profile = store.getProfileByEmail("user@gmail.com");
    expect(profile?.fullName).toBe("New Google Name");
  });

  it("backfills an existing profile that lacks fullName/pictureUrl", async () => {
    // Pre-create a profile with no identity fields (the social-svc
    // ghost case from the audit).
    store.upsertProfile({
      email: "stranded@gmail.com",
      handle: "stranded",
      displayFirst: "Stranded",
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
      createdAt: 1,
      updatedAt: 1,
    });
    mockMem0([
      {
        email: "stranded@gmail.com",
        display_name: "Stranded Person",
        picture_url: "https://lh3.googleusercontent.com/s/avatar.jpg",
      },
    ]);
    const r = await request(app)
      .post("/v1/social/admin/reconcile-from-mem0")
      .set(headers("admin@learnai.dev"))
      .send({ mem0Url: "https://m0", mem0AdminApiKey: "k" });
    expect(r.body.updated).toContain("stranded@gmail.com");
    const profile = store.getProfileByEmail("stranded@gmail.com");
    expect(profile?.fullName).toBe("Stranded Person");
    expect(profile?.pictureUrl).toBe(
      "https://lh3.googleusercontent.com/s/avatar.jpg",
    );
  });
});
