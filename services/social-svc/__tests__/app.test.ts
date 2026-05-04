import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { createStore, type Store } from "../src/store.js";

let store: Store;
let app: ReturnType<typeof createApp>;

beforeEach(() => {
  store = createStore();
  // Tests use the demo header path (X-User-Email) for simplicity. The
  // production path (session-JWT verification) is exercised in the
  // dedicated `__tests__/jwt.test.ts` suite.
  app = createApp({ store, admins: ["admin@learnai.dev"], demoTrustHeader: true });
});

afterEach(() => {
  store.reset();
});

const userHeaders = (email: string) => ({ "x-user-email": email });

describe("/health", () => {
  it("returns ok", async () => {
    const r = await request(app).get("/health");
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ status: "ok" });
  });
});

describe("/v1/social/me", () => {
  it("requires X-User-Email", async () => {
    const r = await request(app).get("/v1/social/me");
    expect(r.status).toBe(401);
  });

  it("auto-creates a profile on first authenticated request", async () => {
    const r = await request(app)
      .get("/v1/social/me")
      .set(userHeaders("Maya@Gmail.com"));
    expect(r.status).toBe(200);
    expect(r.body.handle).toBe("maya");
    expect(r.body.profileMode).toBe("open");
    expect(r.body.ownerPrefs).toBeDefined();
  });

  it("disambiguates handles for collisions", async () => {
    await request(app).get("/v1/social/me").set(userHeaders("maya@gmail.com"));
    const r = await request(app)
      .get("/v1/social/me")
      .set(userHeaders("maya@example.org"));
    expect(r.status).toBe(200);
    expect(r.body.handle).toBe("maya2");
  });

  it("PUT /me persists patches and returns updated projection", async () => {
    await request(app).get("/v1/social/me").set(userHeaders("maya@gmail.com"));
    const r = await request(app)
      .put("/v1/social/me")
      .set(userHeaders("maya@gmail.com"))
      .send({ fullName: "Maya Patel", showFullName: true });
    expect(r.status).toBe(200);
    expect(r.body.displayName).toBe("Maya Patel");
  });

  it("PUT /me/signals caps at 5 and dedupes", async () => {
    await request(app).get("/v1/social/me").set(userHeaders("maya@gmail.com"));
    const r = await request(app)
      .put("/v1/social/me/signals")
      .set(userHeaders("maya@gmail.com"))
      .send({
        topics: [
          "ai-foundations",
          "ai-pm",
          "ai-builder",
          "ai-trends",
          "ai-news",
          "memory-safety",
          "ai-pm",
        ],
      });
    expect(r.status).toBe(200);
    expect(r.body.topics.length).toBe(5);
  });
});

describe("/v1/social/profiles/:handle", () => {
  beforeEach(async () => {
    // Maya has an Open profile. Priya has a Closed profile.
    await request(app).get("/v1/social/me").set(userHeaders("maya@gmail.com"));
    await request(app).get("/v1/social/me").set(userHeaders("priya@gmail.com"));
    await request(app)
      .put("/v1/social/me")
      .set(userHeaders("priya@gmail.com"))
      .send({ profileMode: "closed" });
  });

  it("returns full profile for an Open viewer", async () => {
    const r = await request(app)
      .get("/v1/social/profiles/maya")
      .set(userHeaders("priya@gmail.com"));
    expect(r.status).toBe(200);
    expect(r.body.handle).toBe("maya");
    expect(r.body.ownerPrefs).toBeUndefined();
  });

  it("returns the closed-stub for a non-follower of a Closed profile", async () => {
    const r = await request(app)
      .get("/v1/social/profiles/priya")
      .set(userHeaders("maya@gmail.com"));
    expect(r.status).toBe(200);
    expect(r.body.profileMode).toBe("closed");
    expect(r.body.topicMap).toBeUndefined();
    expect(r.body.activity14d).toBeUndefined();
  });

  it("returns 404 for a blocked viewer", async () => {
    await request(app)
      .post("/v1/social/blocks/priya")
      .set(userHeaders("maya@gmail.com"));
    const r = await request(app)
      .get("/v1/social/profiles/priya")
      .set(userHeaders("maya@gmail.com"));
    expect(r.status).toBe(404);
  });
});

describe("follow / unfollow / block", () => {
  beforeEach(async () => {
    await request(app).get("/v1/social/me").set(userHeaders("maya@gmail.com"));
    await request(app).get("/v1/social/me").set(userHeaders("priya@gmail.com"));
  });

  it("POST follow on an Open profile is approved immediately and idempotent", async () => {
    const r1 = await request(app)
      .post("/v1/social/follow/priya")
      .set(userHeaders("maya@gmail.com"));
    expect(r1.status).toBe(201);
    expect(r1.body.status).toBe("approved");
    const r2 = await request(app)
      .post("/v1/social/follow/priya")
      .set(userHeaders("maya@gmail.com"));
    expect(r2.status).toBe(200);
    // Wire-shape contract: the server projects email → handle on
    // every FollowEdge before it leaves. See the comment block above
    // `projectEdge` in `app.ts` for why.
    expect(r2.body.target).toBe("priya");
  });

  it("POST follow on a Closed profile creates a pending request", async () => {
    await request(app)
      .put("/v1/social/me")
      .set(userHeaders("priya@gmail.com"))
      .send({ profileMode: "closed" });
    const r = await request(app)
      .post("/v1/social/follow/priya")
      .set(userHeaders("maya@gmail.com"));
    expect(r.status).toBe(201);
    expect(r.body.status).toBe("pending");
  });

  it("Approve flow flips a pending edge to approved", async () => {
    await request(app)
      .put("/v1/social/me")
      .set(userHeaders("priya@gmail.com"))
      .send({ profileMode: "closed" });
    await request(app)
      .post("/v1/social/follow/priya")
      .set(userHeaders("maya@gmail.com"));
    const r = await request(app)
      .post("/v1/social/requests/maya@gmail.com/approve")
      .set(userHeaders("priya@gmail.com"));
    expect(r.status).toBe(204);
    const list = await request(app)
      .get("/v1/social/me/followers?status=approved")
      .set(userHeaders("priya@gmail.com"));
    expect(list.body.length).toBe(1);
  });

  it("DELETE follow removes the edge", async () => {
    await request(app)
      .post("/v1/social/follow/priya")
      .set(userHeaders("maya@gmail.com"));
    await request(app)
      .delete("/v1/social/follow/priya")
      .set(userHeaders("maya@gmail.com"));
    const list = await request(app)
      .get("/v1/social/me/following")
      .set(userHeaders("maya@gmail.com"));
    expect(list.body).toEqual([]);
  });

  it("self-follow → 409", async () => {
    const r = await request(app)
      .post("/v1/social/follow/maya")
      .set(userHeaders("maya@gmail.com"));
    expect(r.status).toBe(409);
  });

  it("block precedence removes existing follow edges", async () => {
    await request(app)
      .post("/v1/social/follow/priya")
      .set(userHeaders("maya@gmail.com"));
    await request(app)
      .post("/v1/social/blocks/priya")
      .set(userHeaders("maya@gmail.com"));
    const list = await request(app)
      .get("/v1/social/me/following")
      .set(userHeaders("maya@gmail.com"));
    expect(list.body).toEqual([]);
    const blocked = await request(app)
      .get("/v1/social/me/blocked")
      .set(userHeaders("maya@gmail.com"));
    expect(blocked.body).toContain("priya@gmail.com");
  });
});

describe("snapshot + stream", () => {
  beforeEach(async () => {
    await request(app).get("/v1/social/me").set(userHeaders("maya@gmail.com"));
    await request(app).get("/v1/social/me").set(userHeaders("priya@gmail.com"));
    await request(app)
      .post("/v1/social/follow/priya")
      .set(userHeaders("maya@gmail.com"));
  });

  it("snapshot upsert updates the public projection", async () => {
    const now = Date.now();
    const r = await request(app)
      .post("/v1/social/me/snapshot")
      .set(userHeaders("priya@gmail.com"))
      .send({
        xpTotal: 240,
        xpWeek: 80,
        xpMonth: 240,
        streak: 7,
        guildTier: "Architect",
        currentTopicId: "ai-pm",
        currentLevel: 4,
        badges: ["first-spark"],
        topicXp: { "ai-pm": 240 },
        activity14d: new Array(14).fill(2),
        events: [],
        clientWindow: { from: now - 1000, to: now },
      });
    expect(r.status).toBe(204);
    const me = await request(app)
      .get("/v1/social/me")
      .set(userHeaders("priya@gmail.com"));
    expect(me.body.xpTotal).toBe(240);
    expect(me.body.streak).toBe(7);
    expect(me.body.guildTier).toBe("Architect");
  });

  it("snapshot accepts a >10% XP drop (logs a warning, no 409)", async () => {
    // Reverses the prior `implausible_xp` 409 contract. A user whose
    // local SPA legitimately has lower XP than the server (admin reset,
    // account merge, post-bug rebuild) was permanently locked out — the
    // public profile pinned on the stale higher number forever. Since
    // `requireUser` ensures only the user themselves can write to their
    // own aggregate, a self-rollback isn't a real attack: we accept and
    // log. See `services/social-svc/src/app.ts` "xp_drop_accepted".
    const now = Date.now();
    await request(app)
      .post("/v1/social/me/snapshot")
      .set(userHeaders("priya@gmail.com"))
      .send({
        xpTotal: 1000,
        xpWeek: 0, xpMonth: 0, streak: 0, guildTier: "Builder",
        badges: [], topicXp: {}, activity14d: [], events: [],
        clientWindow: { from: now - 1000, to: now },
      });
    const r = await request(app)
      .post("/v1/social/me/snapshot")
      .set(userHeaders("priya@gmail.com"))
      .send({
        xpTotal: 100, // 90% lower
        xpWeek: 0, xpMonth: 0, streak: 0, guildTier: "Builder",
        badges: [], topicXp: {}, activity14d: [], events: [],
        clientWindow: { from: now - 500, to: now + 1000 },
      });
    expect(r.status).toBe(204);
    // The new value should be canonical — the public profile reflects
    // what the user just pushed, not the stale higher aggregate.
    const me = await request(app)
      .get("/v1/social/me")
      .set(userHeaders("priya@gmail.com"));
    expect(me.body.xpTotal).toBe(100);
  });

  // Regression: a snapshot with xpTotal=0 is the textbook "fresh device"
  // signal — local state was wiped (e.g. by the cross-account-leak fix in
  // #72) and the SPA hasn't pulled the server snapshot back yet. Treat it
  // as a no-op so the client stops retrying every focus-regen tick and
  // the server's existing aggregate (the canonical record) is preserved.
  it("snapshot with xpTotal=0 against a populated aggregate is a no-op, not 409", async () => {
    const now = Date.now();
    await request(app)
      .post("/v1/social/me/snapshot")
      .set(userHeaders("priya@gmail.com"))
      .send({
        xpTotal: 1000,
        xpWeek: 0, xpMonth: 0, streak: 5, guildTier: "Architect",
        badges: ["first-spark"], topicXp: { "ai-pm": 1000 }, activity14d: [],
        events: [], clientWindow: { from: now - 1000, to: now },
      });
    const r = await request(app)
      .post("/v1/social/me/snapshot")
      .set(userHeaders("priya@gmail.com"))
      .send({
        xpTotal: 0,
        xpWeek: 0, xpMonth: 0, streak: 0, guildTier: "Builder",
        badges: [], topicXp: {}, activity14d: [], events: [],
        clientWindow: { from: now - 500, to: now + 1000 },
      });
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ ok: true, noop: "fresh_device" });
    // Canonical aggregate survives untouched.
    const me = await request(app)
      .get("/v1/social/me")
      .set(userHeaders("priya@gmail.com"));
    expect(me.body.xpTotal).toBe(1000);
    expect(me.body.streak).toBe(5);
    expect(me.body.guildTier).toBe("Architect");
  });

  it("stream returns events from approved follows only, with self/blocked filtered", async () => {
    const now = Date.now();
    // Priya posts a level_up event.
    await request(app)
      .post("/v1/social/me/snapshot")
      .set(userHeaders("priya@gmail.com"))
      .send({
        xpTotal: 120, xpWeek: 60, xpMonth: 60, streak: 5, guildTier: "Architect",
        badges: [], topicXp: {}, activity14d: [],
        events: [{ kind: "level_up", topicId: "ai-builder", level: 7, clientId: "c1" }],
        clientWindow: { from: now - 1000, to: now },
      });
    // Maya — who follows Priya — fetches the stream.
    const r = await request(app)
      .get("/v1/social/stream?limit=10")
      .set(userHeaders("maya@gmail.com"));
    expect(r.status).toBe(200);
    expect(r.body.length).toBe(1);
    expect(r.body[0].kind).toBe("level_up");
    expect(r.body[0].authorHandle).toBe("priya");
  });
});

describe("reports + admin moderation", () => {
  beforeEach(async () => {
    await request(app).get("/v1/social/me").set(userHeaders("maya@gmail.com"));
    await request(app).get("/v1/social/me").set(userHeaders("priya@gmail.com"));
  });

  it("non-admin cannot list reports", async () => {
    const r = await request(app)
      .get("/v1/social/admin/reports")
      .set(userHeaders("maya@gmail.com"));
    expect(r.status).toBe(403);
  });

  it("admin can list reports and resolve them", async () => {
    await request(app)
      .post("/v1/social/reports")
      .set(userHeaders("maya@gmail.com"))
      .send({ targetHandle: "priya", reason: "spam", note: "noisy" });
    const list = await request(app)
      .get("/v1/social/admin/reports?status=open")
      .set(userHeaders("admin@learnai.dev"));
    expect(list.status).toBe(200);
    expect(list.body.length).toBe(1);
    const id = list.body[0].id;
    const resolve = await request(app)
      .post(`/v1/social/admin/reports/${id}/resolve`)
      .set(userHeaders("admin@learnai.dev"))
      .send({ resolution: "no-action" });
    expect(resolve.status).toBe(200);
    expect(resolve.body.status).toBe("resolved");
    expect(resolve.body.resolvedBy).toBe("admin@learnai.dev");
  });

  it("rejects an invalid reason", async () => {
    const r = await request(app)
      .post("/v1/social/reports")
      .set(userHeaders("maya@gmail.com"))
      .send({ targetHandle: "priya", reason: "not-real" });
    expect(r.status).toBe(400);
  });
});

describe("Sprint 2.5 fixes", () => {
  describe("auth model — session JWT vs demo header (replaces P0-2 upstream-bearer)", () => {
    it("rejects requests with no Authorization and no demo header path", async () => {
      const strict = createApp({
        store: createStore(),
        jwtSecret: "test-secret",
        demoTrustHeader: false,
      });
      const r = await request(strict).get("/v1/social/me");
      expect(r.status).toBe(401);
      expect(r.body.error).toBe("unauthenticated");
    });

    it("accepts a valid session JWT signed with the configured secret", async () => {
      const { SignJWT } = await import("jose");
      const secret = new TextEncoder().encode("test-secret");
      const token = await new SignJWT({ email: "maya@gmail.com" })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("1h")
        .sign(secret);
      const strict = createApp({
        store: createStore(),
        jwtSecret: "test-secret",
        demoTrustHeader: false,
      });
      const r = await request(strict)
        .get("/v1/social/me")
        .set("authorization", `Bearer ${token}`);
      expect(r.status).toBe(200);
      expect(r.body.email).toBe("maya@gmail.com");
    });

    it("rejects a JWT signed with the wrong secret", async () => {
      const { SignJWT } = await import("jose");
      const wrong = new TextEncoder().encode("wrong-secret");
      const token = await new SignJWT({ email: "maya@gmail.com" })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("1h")
        .sign(wrong);
      const strict = createApp({
        store: createStore(),
        jwtSecret: "right-secret",
        demoTrustHeader: false,
      });
      const r = await request(strict)
        .get("/v1/social/me")
        .set("authorization", `Bearer ${token}`);
      expect(r.status).toBe(401);
    });

    it("/health requires no auth at all", async () => {
      const strict = createApp({
        store: createStore(),
        jwtSecret: "test-secret",
        demoTrustHeader: false,
      });
      const r = await request(strict).get("/health");
      expect(r.status).toBe(200);
    });

    it("createApp({demoTrustHeader:true}) refuses under NODE_ENV=production", () => {
      const orig = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";
      try {
        expect(() =>
          createApp({ store: createStore(), demoTrustHeader: true }),
        ).toThrow(/refused/i);
      } finally {
        process.env.NODE_ENV = orig;
      }
    });
  });

  describe("non-owner email leak fix (P0-3)", () => {
    beforeEach(async () => {
      await request(app).get("/v1/social/me").set(userHeaders("maya@gmail.com"));
      await request(app).get("/v1/social/me").set(userHeaders("priya@gmail.com"));
    });

    it("returns empty email when the viewer is not the owner", async () => {
      const r = await request(app)
        .get("/v1/social/profiles/maya")
        .set(userHeaders("priya@gmail.com"));
      expect(r.status).toBe(200);
      expect(r.body.email).toBe("");
      expect(r.body.handle).toBe("maya");
    });

    it("returns the owner's email back to the owner", async () => {
      const r = await request(app)
        .get("/v1/social/me")
        .set(userHeaders("maya@gmail.com"));
      expect(r.body.email).toBe("maya@gmail.com");
    });
  });

  describe("snapshot validation (P0-6)", () => {
    beforeEach(async () => {
      await request(app).get("/v1/social/me").set(userHeaders("maya@gmail.com"));
    });

    it("returns 400 (not 500) on a malformed body", async () => {
      const r = await request(app)
        .post("/v1/social/me/snapshot")
        .set(userHeaders("maya@gmail.com"))
        .send({});
      expect(r.status).toBe(400);
      expect(r.body.error).toBe("invalid_snapshot");
    });

    it("rejects out-of-range XP", async () => {
      const r = await request(app)
        .post("/v1/social/me/snapshot")
        .set(userHeaders("maya@gmail.com"))
        .send({
          xpTotal: 1e10,
          streak: 0,
          guildTier: "Builder",
          clientWindow: { from: 0, to: Date.now() },
        });
      expect(r.status).toBe(400);
      expect(r.body.error).toBe("xp_out_of_range");
    });
  });

  describe("snapshot clientId idempotency (P0-5)", () => {
    beforeEach(async () => {
      await request(app).get("/v1/social/me").set(userHeaders("priya@gmail.com"));
      await request(app).get("/v1/social/me").set(userHeaders("maya@gmail.com"));
      await request(app)
        .post("/v1/social/follow/priya")
        .set(userHeaders("maya@gmail.com"));
    });

    it("does not multiply stream events when the same snapshot is replayed", async () => {
      const cw = { from: 0, to: Date.now() };
      const body = {
        xpTotal: 100,
        streak: 1,
        guildTier: "Builder",
        clientWindow: cw,
        events: [
          { kind: "level_up", topicId: "ai-builder", level: 3, clientId: "evt-1" },
        ],
      };
      const r1 = await request(app)
        .post("/v1/social/me/snapshot")
        .set(userHeaders("priya@gmail.com"))
        .send(body);
      expect(r1.status).toBe(204);
      // Replay the same snapshot — server must dedupe by clientId.
      const r2 = await request(app)
        .post("/v1/social/me/snapshot")
        .set(userHeaders("priya@gmail.com"))
        .send({ ...body, xpTotal: 110 });
      expect(r2.status).toBe(204);
      // maya is following priya, so her stream contains priya's events only.
      const stream = await request(app)
        .get("/v1/social/stream")
        .set(userHeaders("maya@gmail.com"));
      const fromPriya = stream.body.filter(
        (c: { authorHandle: string }) => c.authorHandle === "priya",
      );
      expect(fromPriya.length).toBe(1);
    });

    it("rejects events with an unknown kind", async () => {
      await request(app).get("/v1/social/me").set(userHeaders("priya@gmail.com"));
      const r = await request(app)
        .post("/v1/social/me/snapshot")
        .set(userHeaders("priya@gmail.com"))
        .send({
          xpTotal: 1,
          streak: 0,
          guildTier: "Builder",
          clientWindow: { from: 0, to: Date.now() },
          events: [
            { kind: "totally-fake-kind", clientId: "x" },
            { kind: "level_up", topicId: "ai-pm", level: 2, clientId: "y" },
          ],
        });
      expect(r.status).toBe(204);
      // The fake kind row is dropped; only the level_up survives. We
      // can't read priya's stream directly, but a follow + read shows it.
      await request(app)
        .post("/v1/social/follow/priya")
        .set(userHeaders("maya@gmail.com"));
      const stream = await request(app)
        .get("/v1/social/stream")
        .set(userHeaders("maya@gmail.com"));
      expect(stream.body.every((c: { kind: string }) => c.kind === "level_up")).toBe(true);
    });
  });

  describe("ageBand acceptance + kid-safety (P0-8)", () => {
    beforeEach(async () => {
      await request(app).get("/v1/social/me").set(userHeaders("kid@gmail.com"));
    });

    it("PUT /me with ageBand=kid forces profileMode=closed and signalsGlobal=false", async () => {
      const r = await request(app)
        .put("/v1/social/me")
        .set(userHeaders("kid@gmail.com"))
        .send({ ageBand: "kid", profileMode: "open", signalsGlobal: true });
      expect(r.status).toBe(200);
      expect(r.body.profileMode).toBe("closed");
      expect(r.body.ageBandIsKid).toBe(true);
      expect(r.body.ownerPrefs.signalsGlobal).toBe(false);
    });

    it("kid → adult escape is blocked once set", async () => {
      await request(app)
        .put("/v1/social/me")
        .set(userHeaders("kid@gmail.com"))
        .send({ ageBand: "kid" });
      const r = await request(app)
        .put("/v1/social/me")
        .set(userHeaders("kid@gmail.com"))
        .send({ ageBand: "adult" });
      expect(r.status).toBe(200);
      expect(r.body.ageBandIsKid).toBe(true);
    });
  });

  describe("closed-stub leak fix (P1-5)", () => {
    beforeEach(async () => {
      await request(app).get("/v1/social/me").set(userHeaders("priya@gmail.com"));
      await request(app).get("/v1/social/me").set(userHeaders("maya@gmail.com"));
      await request(app)
        .put("/v1/social/me")
        .set(userHeaders("priya@gmail.com"))
        .send({ profileMode: "closed" });
    });

    it("returns the gated stub without email/picture/ageBand to non-followers", async () => {
      const r = await request(app)
        .get("/v1/social/profiles/priya")
        .set(userHeaders("maya@gmail.com"));
      expect(r.status).toBe(200);
      expect(r.body.profileMode).toBe("closed");
      expect(r.body.email).toBe("");
      expect(r.body.pictureUrl).toBeUndefined();
      expect(r.body.ageBandIsKid).toBe(false);
      expect(r.body.signupAt).toBe(0);
    });
  });
});

describe("/v1/social/boards/:scope", () => {
  beforeEach(async () => {
    for (const email of ["me@gmail.com", "alpha@gmail.com", "bravo@gmail.com", "closed@gmail.com"]) {
      await request(app).get("/v1/social/me").set(userHeaders(email));
    }
    await request(app)
      .put("/v1/social/me")
      .set(userHeaders("closed@gmail.com"))
      .send({ profileMode: "closed" });
    await request(app)
      .put("/v1/social/me/signals")
      .set(userHeaders("alpha@gmail.com"))
      .send({ topics: ["ai-foundations"] });
    store.upsertAggregate({
      email: "alpha@gmail.com",
      xpTotal: 500,
      streak: 1,
      guildTier: "Builder",
      badges: [],
      activity14d: [],
      topicXp: { "ai-foundations": 500 },
      updatedAt: Date.now(),
    });
    store.upsertAggregate({
      email: "bravo@gmail.com",
      xpTotal: 200,
      streak: 1,
      guildTier: "Builder",
      badges: [],
      activity14d: [],
      topicXp: {},
      updatedAt: Date.now(),
    });
  });

  it("returns Open profiles ranked by xpTotal on global scope, excluding self + closed", async () => {
    const r = await request(app)
      .get("/v1/social/boards/global?period=all")
      .set(userHeaders("me@gmail.com"));
    expect(r.status).toBe(200);
    const handles = (r.body as Array<{ handle: string }>).map((p) => p.handle);
    expect(handles).toEqual(["alpha", "bravo"]);
  });

  it("filters topic boards to profiles whose Signals include the topic", async () => {
    const r = await request(app)
      .get("/v1/social/boards/topic%3Aai-foundations?period=all")
      .set(userHeaders("me@gmail.com"));
    expect(r.status).toBe(200);
    const handles = (r.body as Array<{ handle: string }>).map((p) => p.handle);
    expect(handles).toEqual(["alpha"]);
  });

  it("following scope returns approved+unmuted follows only", async () => {
    await request(app)
      .post("/v1/social/follow/alpha")
      .set(userHeaders("me@gmail.com"));
    await request(app)
      .post("/v1/social/follow/bravo")
      .set(userHeaders("me@gmail.com"));
    await request(app)
      .put("/v1/social/follow/bravo/mute")
      .set(userHeaders("me@gmail.com"))
      .send({ muted: true });
    const r = await request(app)
      .get("/v1/social/boards/following?period=all")
      .set(userHeaders("me@gmail.com"));
    expect(r.status).toBe(200);
    const handles = (r.body as Array<{ handle: string }>).map((p) => p.handle);
    expect(handles).toEqual(["alpha"]);
  });
});
