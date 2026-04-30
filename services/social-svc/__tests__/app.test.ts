import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { createStore, type Store } from "../src/store.js";

let store: Store;
let app: ReturnType<typeof createApp>;

beforeEach(() => {
  store = createStore();
  app = createApp({ store, admins: ["admin@learnai.dev"] });
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
    expect(r2.body.target.toLowerCase()).toBe("priya@gmail.com");
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

  it("snapshot rejects implausible XP regression with 409", async () => {
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
    expect(r.status).toBe(409);
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
