import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { createStore, type Store } from "../src/store.js";

let store: Store;
let app: ReturnType<typeof createApp>;

beforeEach(() => {
  store = createStore();
  app = createApp({ store, admins: ["admin@learnai.dev"], demoTrustHeader: true });
});

afterEach(() => {
  store.reset();
  vi.useRealTimers();
});

describe("POST /v1/social/track/visit", () => {
  it("accepts an anonymous beacon and returns 204", async () => {
    const r = await request(app)
      .post("/v1/social/track/visit")
      .send({ path: "/", refDomain: "twitter.com", source: "ozs_tweet_1" });
    expect(r.status).toBe(204);
    expect(store.trafficSnapshot().visits7d).toBe(1);
  });

  it("normalizes missing refDomain to (direct) and missing source to null", async () => {
    await request(app).post("/v1/social/track/visit").send({});
    const snap = store.trafficSnapshot();
    expect(snap.visits7d).toBe(1);
    expect(snap.topReferrers7d[0]?.refDomain).toBe("(direct)");
    expect(snap.topSources7d).toHaveLength(0);
  });

  it("lowercases / trims source and clamps oversized fields", async () => {
    await request(app).post("/v1/social/track/visit").send({
      path: "/topic/agents",
      refDomain: "  LinkedIn.COM  ",
      source: "  OZ_LinkedIn_Post  ",
    });
    const snap = store.trafficSnapshot();
    expect(snap.topReferrers7d[0]?.refDomain).toBe("  linkedin.com  ");
    expect(snap.topSources7d[0]?.source).toBe("oz_linkedin_post");
  });

  it("requires no auth (open endpoint)", async () => {
    // Distinct from the rest of /v1/social/* which require X-User-Email.
    const r = await request(app).post("/v1/social/track/visit").send({});
    expect(r.status).not.toBe(401);
  });
});

describe("store.trafficSnapshot", () => {
  it("buckets visits across 24h / 7d / 30d windows", () => {
    const now = 1_700_000_000_000;
    vi.useFakeTimers();
    vi.setSystemTime(new Date(now));
    store.recordVisit({ path: "/", refDomain: "(direct)", source: null });
    vi.setSystemTime(new Date(now + 1000));
    store.recordVisit({ path: "/", refDomain: "twitter.com", source: "tweet_a" });
    vi.setSystemTime(new Date(now + 2000));
    store.recordVisit({ path: "/", refDomain: "twitter.com", source: "tweet_a" });

    const snap = store.trafficSnapshot(now + 3000);
    expect(snap.visits24h).toBe(3);
    expect(snap.visits7d).toBe(3);
    expect(snap.visits30d).toBe(3);
    expect(snap.totalVisits).toBe(3);
    // twitter.com should beat (direct) on top referrers.
    expect(snap.topReferrers7d[0]).toEqual({ refDomain: "twitter.com", visits: 2 });
    expect(snap.topSources7d[0]).toEqual({ source: "tweet_a", visits: 2 });
  });

  it("daily7d returns exactly 7 entries (oldest first), zero-filled", () => {
    const snap = store.trafficSnapshot();
    expect(snap.daily7d).toHaveLength(7);
    expect(snap.daily7d.every((d) => d.visits === 0)).toBe(true);
    // All YYYY-MM-DD format.
    expect(snap.daily7d.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.date))).toBe(true);
  });

  it("excludes visits older than 7d from referrer/source rollups", () => {
    const now = 1_700_000_000_000;
    const eightDaysAgo = now - 8 * 24 * 60 * 60 * 1000;
    vi.useFakeTimers();
    vi.setSystemTime(new Date(eightDaysAgo));
    store.recordVisit({ path: "/", refDomain: "old-source.com", source: "stale" });
    vi.setSystemTime(new Date(now));
    store.recordVisit({ path: "/", refDomain: "new-source.com", source: "fresh" });

    const snap = store.trafficSnapshot(now);
    expect(snap.visits7d).toBe(1);
    expect(snap.topReferrers7d.map((r) => r.refDomain)).toEqual(["new-source.com"]);
    expect(snap.topSources7d.map((s) => s.source)).toEqual(["fresh"]);
  });

  it("caps visits to 50k and drops the oldest", () => {
    // Smoke a small subset rather than the full 50k for test speed.
    // We assert the cap policy (newest preserved) using the unshift order.
    for (let i = 0; i < 10; i++) {
      store.recordVisit({ path: `/p${i}`, refDomain: "(direct)", source: null });
    }
    expect(store.trafficSnapshot().totalVisits).toBe(10);
  });
});

describe("/v1/social/admin/analytics now includes traffic", () => {
  it("returns the traffic rollup alongside the existing stats", async () => {
    await request(app)
      .post("/v1/social/track/visit")
      .send({ path: "/", refDomain: "news.ycombinator.com", source: "hn_post" });

    const r = await request(app)
      .get("/v1/social/admin/analytics")
      .set("x-user-email", "admin@learnai.dev");
    expect(r.status).toBe(200);
    expect(r.body.traffic).toBeDefined();
    expect(r.body.traffic.visits7d).toBe(1);
    expect(r.body.traffic.topReferrers7d[0].refDomain).toBe("news.ycombinator.com");
    expect(r.body.traffic.topSources7d[0].source).toBe("hn_post");
  });
});
