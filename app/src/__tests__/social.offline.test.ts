import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { OfflineSocialService } from "../social/offline";
import { selectSocialService, withSocialGuard } from "../social";
import type { PlayerSnapshot } from "../social/types";

function makeSvc(email = "maya@gmail.com", kid = false) {
  return new OfflineSocialService({ email, ageBandIsKid: kid });
}

beforeEach(() => {
  window.localStorage.clear();
});
afterEach(() => {
  window.localStorage.clear();
});

describe("OfflineSocialService — profile + signals", () => {
  it("getMyProfile returns a default Open profile keyed off the email", async () => {
    const svc = makeSvc("Maya@Gmail.com");
    const me = await svc.getMyProfile();
    expect(me.handle).toBe("maya");
    expect(me.profileMode).toBe("open");
    expect(me.signals).toEqual([]);
    expect(me.xpTotal).toBe(0);
    expect(me.displayName).toBe("Maya"); // fallback to capitalized handle
  });

  it("kid profiles are forced to closed and cannot flip to open", async () => {
    const svc = makeSvc("kiddo@gmail.com", true);
    let me = await svc.getMyProfile();
    expect(me.profileMode).toBe("closed");
    me = await svc.updateProfile({ profileMode: "open" });
    expect(me.profileMode).toBe("closed");
  });

  it("updateProfile persists patches and getMyProfile reflects them", async () => {
    const svc = makeSvc();
    await svc.updateProfile({ fullName: "Maya Patel", showFullName: true });
    const me = await svc.getMyProfile();
    expect(me.displayName).toBe("Maya Patel");
  });

  it("getProfile(myHandle) hides showFullName when the viewer isn't owner", async () => {
    const svc = makeSvc();
    await svc.updateProfile({ fullName: "Maya Patel", showFullName: false });
    const stranger = await svc.getProfile("maya");
    expect(stranger?.displayName).toBe("Maya");
  });

  it("setSignals caps at 5 and dedupes", async () => {
    const svc = makeSvc();
    const got = await svc.setSignals([
      "ai-foundations",
      "ai-pm",
      "ai-builder",
      "ai-trends",
      "ai-news",
      "memory-safety", // 6th — should be dropped
      "ai-pm", // dup
    ] as never);
    expect(got).toHaveLength(5);
    expect(new Set(got).size).toBe(5);
  });
});

describe("OfflineSocialService — follow / block / report", () => {
  it("follow is idempotent — second call returns the same edge", async () => {
    const svc = makeSvc();
    const e1 = await svc.follow("priya");
    const e2 = await svc.follow("priya");
    expect(e1.target).toBe("priya");
    expect(e2.createdAt).toBe(e1.createdAt);
    const list = await svc.listFollowing();
    expect(list).toHaveLength(1);
  });

  it("unfollow removes the edge", async () => {
    const svc = makeSvc();
    await svc.follow("priya");
    await svc.unfollow("priya");
    expect(await svc.listFollowing()).toEqual([]);
  });

  it("block removes any existing follow edge in either direction", async () => {
    const svc = makeSvc();
    await svc.follow("priya");
    await svc.block("priya");
    expect(await svc.listFollowing()).toEqual([]);
    expect(await svc.listBlocked()).toContain("priya");
  });

  it("unblock removes the entry but does not restore the follow", async () => {
    const svc = makeSvc();
    await svc.follow("priya");
    await svc.block("priya");
    await svc.unblock("priya");
    expect(await svc.listBlocked()).toEqual([]);
    expect(await svc.listFollowing()).toEqual([]);
  });

  it("report logs the report and auto-mutes the followed target", async () => {
    const svc = makeSvc();
    await svc.follow("priya");
    await svc.report("priya", "spam", "noise");
    const list = await svc.listFollowing();
    expect(list[0]?.muted).toBe(true);
  });

  it("setMuted flips the muted flag", async () => {
    const svc = makeSvc();
    await svc.follow("priya");
    await svc.setMuted("priya", true);
    let list = await svc.listFollowing();
    expect(list[0]?.muted).toBe(true);
    await svc.setMuted("priya", false);
    list = await svc.listFollowing();
    expect(list[0]?.muted).toBe(false);
  });
});

describe("OfflineSocialService — snapshots + boards/stream", () => {
  it("pushSnapshot updates the public projection", async () => {
    const svc = makeSvc();
    const snap: PlayerSnapshot = {
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
      clientWindow: { from: 0, to: Date.now() },
    };
    await svc.pushSnapshot(snap);
    const me = await svc.getMyProfile();
    expect(me.xpTotal).toBe(240);
    expect(me.streak).toBe(7);
    expect(me.guildTier).toBe("Architect");
    expect(me.currentWork?.topicId).toBe("ai-pm");
    expect(me.activity14d).toHaveLength(14);
  });

  it("getBoard / getStream return [] in offline mode", async () => {
    const svc = makeSvc();
    expect(await svc.getBoard("global", "week")).toEqual([]);
    expect(await svc.getStream()).toEqual([]);
  });

  it("health is always { ok: true, backend: 'offline' }", async () => {
    const svc = makeSvc();
    const h = await svc.health();
    expect(h.ok).toBe(true);
    expect(h.backend).toBe("offline");
  });
});

describe("selectSocialService", () => {
  it("returns offline when socialEnabled=false even with a serverUrl", () => {
    const svc = selectSocialService({
      email: "maya@gmail.com",
      socialEnabled: false,
      serverUrl: "https://example.com",
    });
    expect(svc).toBeInstanceOf(OfflineSocialService);
  });

  it("returns the online client with empty serverUrl when a bearer is present (same-origin production sidecar)", async () => {
    // Production deployment: SPA + sidecar in one container; the SPA calls
    // /v1/social/* on its own origin and nginx proxies to localhost. Empty
    // serverUrl is the correct production config — the bearer (session
    // JWT) is the signal that a real sidecar is reachable.
    const { OnlineSocialService } = await import("../social/online");
    const svc = selectSocialService({
      email: "maya@gmail.com",
      socialEnabled: true,
      serverUrl: "",
      bearerToken: "session-jwt",
    });
    expect(svc).toBeInstanceOf(OnlineSocialService);
  });

  it("falls back to offline when serverUrl AND bearer are both empty (no sidecar reachable)", () => {
    // Without a configured serverUrl AND without a session bearer, relative
    // /v1/social/* fetches hit the SPA fallback (index.html for unknown
    // routes), the JSON client returns undefined, and callers crash on
    // result.map(...). Stay offline so the UI renders cleanly.
    const svc = selectSocialService({
      email: "maya@gmail.com",
      socialEnabled: true,
      serverUrl: "",
      bearerToken: "",
    });
    expect(svc).toBeInstanceOf(OfflineSocialService);
  });

  it("returns offline when no email (pre-signin)", () => {
    const svc = selectSocialService({
      email: "",
      socialEnabled: true,
      serverUrl: "https://example.com",
    });
    expect(svc).toBeInstanceOf(OfflineSocialService);
  });
});

describe("withSocialGuard", () => {
  it("returns the fallback when fn throws", async () => {
    const got = await withSocialGuard(
      async () => {
        throw new Error("boom");
      },
      "fallback",
    );
    expect(got).toBe("fallback");
  });

  it("returns the value when fn succeeds", async () => {
    const got = await withSocialGuard(async () => "ok", "fallback");
    expect(got).toBe("ok");
  });
});
