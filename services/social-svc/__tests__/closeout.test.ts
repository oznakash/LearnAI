import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { createStore, type Store } from "../src/store.js";
import { startSpotlightCron } from "../src/spotlight.js";

let store: Store;
let app: ReturnType<typeof createApp>;

beforeEach(() => {
  store = createStore();
  app = createApp({ store, admins: ["admin@learnai.dev"], demoTrustHeader: true });
});
afterEach(() => {
  store.reset();
});

const userHeaders = (email: string) => ({ "x-user-email": email });

describe("/health enhancement (Sprint 2.5 close-out)", () => {
  it("includes startup-state fields", async () => {
    const r = await request(app).get("/health");
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({
      status: "ok",
      jwt_configured: false, // demo-mode test app has no jwtSecret
      demo_trust_header: true,
      admins: 1,
      backend: "memory-only",
      misconfig: false,
    });
  });

  it("flags misconfig when neither jwt nor demo header is configured", async () => {
    const broken = createApp({ store: createStore(), admins: [], demoTrustHeader: false });
    const r = await request(broken).get("/health");
    expect(r.body.misconfig).toBe(true);
  });
});

describe("Stream Signal-overlap visibility path", () => {
  beforeEach(async () => {
    // Three users: maya (viewer), priya (Open, shares Signal), avi (Open, no Signal overlap).
    await request(app).get("/v1/social/me").set(userHeaders("maya@gmail.com"));
    await request(app).get("/v1/social/me").set(userHeaders("priya@gmail.com"));
    await request(app).get("/v1/social/me").set(userHeaders("avi@gmail.com"));
    // Maya signals AI PM. Priya also signals AI PM. Avi signals AI Trends.
    await request(app)
      .put("/v1/social/me/signals")
      .set(userHeaders("maya@gmail.com"))
      .send({ topics: ["ai-pm"] });
    await request(app)
      .put("/v1/social/me/signals")
      .set(userHeaders("priya@gmail.com"))
      .send({ topics: ["ai-pm"] });
    await request(app)
      .put("/v1/social/me/signals")
      .set(userHeaders("avi@gmail.com"))
      .send({ topics: ["ai-trends"] });
    // Both priya + avi post a level_up event.
    const now = Date.now();
    for (const email of ["priya@gmail.com", "avi@gmail.com"]) {
      await request(app)
        .post("/v1/social/me/snapshot")
        .set(userHeaders(email))
        .send({
          xpTotal: 100,
          streak: 1,
          guildTier: "Builder",
          clientWindow: { from: 0, to: now },
          events: [
            {
              kind: "level_up",
              topicId: email === "priya@gmail.com" ? "ai-pm" : "ai-trends",
              level: 3,
              clientId: `${email}-l1`,
            },
          ],
        });
    }
  });

  it("Maya sees Priya's event (shared Signal) even without following her", async () => {
    const r = await request(app)
      .get("/v1/social/stream")
      .set(userHeaders("maya@gmail.com"));
    expect(r.status).toBe(200);
    const handles = r.body.map((c: { authorHandle: string }) => c.authorHandle);
    expect(handles).toContain("priya");
    // iCanFollow=true on the card (she's not following; profile is open).
    const priyaCard = r.body.find((c: { authorHandle: string }) => c.authorHandle === "priya");
    expect(priyaCard.iAmFollowing).toBe(false);
    expect(priyaCard.iCanFollow).toBe(true);
  });

  it("Maya does NOT see Avi's event (no Signal overlap, not followed)", async () => {
    const r = await request(app)
      .get("/v1/social/stream")
      .set(userHeaders("maya@gmail.com"));
    const handles = r.body.map((c: { authorHandle: string }) => c.authorHandle);
    expect(handles).not.toContain("avi");
  });

  it("Closed-mode authors are excluded from Signal-overlap path", async () => {
    // Priya goes closed; Maya should no longer see her.
    await request(app)
      .put("/v1/social/me")
      .set(userHeaders("priya@gmail.com"))
      .send({ profileMode: "closed" });
    const r = await request(app)
      .get("/v1/social/stream")
      .set(userHeaders("maya@gmail.com"));
    const handles = r.body.map((c: { authorHandle: string }) => c.authorHandle);
    expect(handles).not.toContain("priya");
  });
});

describe("Telemetry endpoint", () => {
  beforeEach(async () => {
    await request(app).get("/v1/social/me").set(userHeaders("admin@learnai.dev"));
    await request(app).get("/v1/social/me").set(userHeaders("maya@gmail.com"));
  });

  it("non-admin gets 403", async () => {
    const r = await request(app)
      .get("/v1/social/admin/analytics")
      .set(userHeaders("maya@gmail.com"));
    expect(r.status).toBe(403);
  });

  it("admin sees aggregate stats", async () => {
    const r = await request(app)
      .get("/v1/social/admin/analytics")
      .set(userHeaders("admin@learnai.dev"));
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({
      profileCount: 2,
      openProfiles: 2,
      closedProfiles: 0,
      kidProfiles: 0,
    });
    expect(typeof r.body.generatedAt).toBe("number");
    expect(typeof r.body.eventsByKind).toBe("object");
    expect(typeof r.body.signalsByTopic).toBe("object");
  });
});

describe("Spotlight cron emits one event per Topic with active Signals", () => {
  it("emits a spotlight for each Topic that has at least one Signal", async () => {
    // Three users with Signals on different Topics + recent activity.
    await request(app).get("/v1/social/me").set(userHeaders("ada@gmail.com"));
    await request(app).get("/v1/social/me").set(userHeaders("ben@gmail.com"));
    await request(app)
      .put("/v1/social/me/signals")
      .set(userHeaders("ada@gmail.com"))
      .send({ topics: ["ai-pm"] });
    await request(app)
      .put("/v1/social/me/signals")
      .set(userHeaders("ben@gmail.com"))
      .send({ topics: ["ai-builder"] });
    const now = Date.now();
    for (const email of ["ada@gmail.com", "ben@gmail.com"]) {
      await request(app)
        .post("/v1/social/me/snapshot")
        .set(userHeaders(email))
        .send({
          xpTotal: 100,
          xpWeek: 60,
          streak: 1,
          guildTier: "Architect",
          clientWindow: { from: 0, to: now },
          events: [
            {
              kind: "level_up",
              topicId: email === "ada@gmail.com" ? "ai-pm" : "ai-builder",
              level: 3,
              clientId: `${email}-x1`,
            },
          ],
        });
    }

    // Run the cron immediately (firstRunMs=10ms) so the test doesn't sleep 60s.
    const stop = startSpotlightCron(store, { firstRunMs: 10, intervalMs: 60_000 });
    await new Promise((r) => setTimeout(r, 50));
    stop();

    const events = store
      .listEventsSince(0, 100)
      .filter((e) => e.kind === "spotlight");
    const topicIds = new Set(events.map((e) => e.topicId));
    expect(topicIds.has("ai-pm")).toBe(true);
    expect(topicIds.has("ai-builder")).toBe(true);
  });

  it("idempotent within a window — re-running doesn't double-emit", async () => {
    await request(app).get("/v1/social/me").set(userHeaders("ada@gmail.com"));
    await request(app)
      .put("/v1/social/me/signals")
      .set(userHeaders("ada@gmail.com"))
      .send({ topics: ["ai-pm"] });
    await request(app)
      .post("/v1/social/me/snapshot")
      .set(userHeaders("ada@gmail.com"))
      .send({
        xpTotal: 100,
        xpWeek: 60,
        streak: 1,
        guildTier: "Architect",
        clientWindow: { from: 0, to: Date.now() },
        events: [{ kind: "level_up", topicId: "ai-pm", level: 3, clientId: "x" }],
      });
    // Two ticks back-to-back, same window.
    const stop1 = startSpotlightCron(store, { firstRunMs: 10, intervalMs: 60_000 });
    await new Promise((r) => setTimeout(r, 50));
    stop1();
    const stop2 = startSpotlightCron(store, { firstRunMs: 10, intervalMs: 60_000 });
    await new Promise((r) => setTimeout(r, 50));
    stop2();

    const events = store.listEventsSince(0, 100).filter((e) => e.kind === "spotlight" && e.topicId === "ai-pm");
    expect(events.length).toBe(1); // dedupe by clientId
  });
});
