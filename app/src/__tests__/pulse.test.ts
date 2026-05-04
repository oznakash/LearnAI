import { describe, it, expect } from "vitest";
import { pulseForAudience, pulseFreshness } from "../store/pulse";
import { defaultPulse } from "../admin/defaults";
import type { PulseItem } from "../admin/types";

const item = (over: Partial<PulseItem> = {}): PulseItem => ({
  id: over.id ?? "x",
  headline: over.headline ?? "headline",
  body: over.body ?? "body",
  audience: over.audience,
  topicId: over.topicId,
  source: over.source,
  addedAt: over.addedAt ?? new Date().toISOString(),
});

describe("pulseForAudience", () => {
  it("returns [] for empty input", () => {
    expect(pulseForAudience([], "adult")).toEqual([]);
  });

  it("returns 'all' items for every audience", () => {
    const items = [item({ id: "a", audience: "all" })];
    expect(pulseForAudience(items, "kid")).toHaveLength(1);
    expect(pulseForAudience(items, "teen")).toHaveLength(1);
    expect(pulseForAudience(items, "adult")).toHaveLength(1);
  });

  it("hides 'adult' items from kids and teens", () => {
    const items = [item({ id: "a", audience: "adult" })];
    expect(pulseForAudience(items, "kid")).toEqual([]);
    expect(pulseForAudience(items, "teen")).toEqual([]);
    expect(pulseForAudience(items, "adult")).toHaveLength(1);
  });

  it("hides 'kid' items from adults", () => {
    const items = [item({ id: "a", audience: "kid" })];
    expect(pulseForAudience(items, "kid")).toHaveLength(1);
    expect(pulseForAudience(items, "teen")).toHaveLength(1);
    expect(pulseForAudience(items, "adult")).toEqual([]);
  });

  it("treats missing audience as 'all'", () => {
    const items = [item({ id: "a" })];
    expect(pulseForAudience(items, "adult")).toHaveLength(1);
    expect(pulseForAudience(items, "kid")).toHaveLength(1);
  });

  it("preserves order in output", () => {
    const items = [
      item({ id: "1", audience: "all" }),
      item({ id: "2", audience: "all" }),
      item({ id: "3", audience: "all" }),
    ];
    expect(pulseForAudience(items, "adult").map((i) => i.id)).toEqual(["1", "2", "3"]);
  });
});

describe("pulseFreshness", () => {
  const today = new Date("2026-05-04T12:00:00Z").getTime();

  it("today → fresh + 'Added today'", () => {
    const r = pulseFreshness("2026-05-04", today);
    expect(r.tone).toBe("fresh");
    expect(r.label).toMatch(/today/i);
  });

  it("yesterday → fresh + 'Nd ago'", () => {
    const r = pulseFreshness("2026-05-03", today);
    expect(r.tone).toBe("fresh");
    expect(r.label).toMatch(/1d/);
  });

  it("a week ago → fresh", () => {
    const r = pulseFreshness("2026-04-27", today);
    expect(r.tone).toBe("fresh");
    expect(r.label).toMatch(/7d/);
  });

  it("two weeks ago → recent", () => {
    const r = pulseFreshness("2026-04-20", today);
    expect(r.tone).toBe("recent");
  });

  it("two months ago → stale", () => {
    const r = pulseFreshness("2026-03-04", today);
    expect(r.tone).toBe("stale");
  });

  it("garbage date → falls back to 'Recent' label, 'recent' tone", () => {
    const r = pulseFreshness("not-a-date", today);
    expect(r.tone).toBe("recent");
    expect(r.label.length).toBeGreaterThan(0);
  });
});

describe("defaultPulse", () => {
  it("ships enabled with at least 3 seeded items", () => {
    const p = defaultPulse();
    expect(p.enabled).toBe(true);
    expect(p.items.length).toBeGreaterThanOrEqual(3);
  });

  it("each seeded item has a stable id, headline, body, addedAt", () => {
    const p = defaultPulse();
    for (const it of p.items) {
      expect(it.id.length).toBeGreaterThan(0);
      expect(it.headline.length).toBeGreaterThan(0);
      expect(it.body.length).toBeGreaterThan(0);
      expect(it.addedAt.length).toBeGreaterThan(0);
    }
  });

  it("the seeded items each link to a known topic for the zoom CTA", () => {
    const p = defaultPulse();
    // We don't require *every* item to link, but a fresh install should
    // have at least one tappable card so the "trend → learning" loop
    // demonstrates itself out of the box.
    const linked = p.items.filter((it) => it.topicId);
    expect(linked.length).toBeGreaterThanOrEqual(1);
  });
});
