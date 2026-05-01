import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ExerciseRenderer } from "../components/Exercise";
import type { Exercise, Spark, Topic } from "../types";
import { ADMIN_STORAGE_KEY, loadAdminConfig, saveAdminConfig } from "../admin/store";
import { defaultAdminConfig } from "../admin/defaults";
import { _resetRuntimeCache, isLennyContentEnabled } from "../admin/runtime";
import { SEED_TOPICS, getTopic, getTopics } from "../content";
import { xpForExercise } from "../store/game";

const LENNY_ROOT = "https://www.lennysnewsletter.com/podcast";

function findPodcastNuggetSparks(topics: readonly Topic[]): Spark[] {
  const out: Spark[] = [];
  for (const t of topics) {
    for (const lvl of t.levels) {
      for (const s of lvl.sparks) {
        if (s.exercise.type === "podcastnugget") out.push(s);
      }
    }
  }
  return out;
}

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

beforeEach(() => {
  window.localStorage.clear();
  _resetRuntimeCache();
});
afterEach(() => {
  window.localStorage.clear();
  _resetRuntimeCache();
});

describe("PodcastNugget — admin feature flag", () => {
  it("defaults to ON (curated nuggets ship with the seed curriculum)", () => {
    const cfg = defaultAdminConfig();
    expect(cfg.flags.lennyContentEnabled).toBe(true);
  });

  it("isLennyContentEnabled() reports true when no admin config has been saved", () => {
    expect(isLennyContentEnabled()).toBe(true);
  });

  it("forward-compat: legacy saved configs without lennyContentEnabled load with default ON", () => {
    const legacy = {
      bootstrapped: true,
      admins: ["maya@gmail.com"],
      flags: {
        // legacy snapshot — no lennyContentEnabled field at all
        allowDemoMode: true,
        socialEnabled: true,
      },
    };
    window.localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(legacy));
    const cfg = loadAdminConfig();
    expect(cfg.flags.lennyContentEnabled).toBe(true);
    expect(isLennyContentEnabled()).toBe(true);
  });

  it("respects an explicit OFF in the saved admin config", () => {
    const cfg = defaultAdminConfig();
    cfg.flags.lennyContentEnabled = false;
    saveAdminConfig(cfg);
    _resetRuntimeCache();
    expect(isLennyContentEnabled()).toBe(false);
  });
});

describe("PodcastNugget — topic loader filtering", () => {
  it("with the flag ON (default), at least 12 nuggets surface across the curriculum", () => {
    const sparks = findPodcastNuggetSparks(getTopics());
    expect(sparks.length).toBeGreaterThanOrEqual(12);
  });

  it("with the flag OFF, every PodcastNugget Spark is stripped from every topic", () => {
    const cfg = defaultAdminConfig();
    cfg.flags.lennyContentEnabled = false;
    saveAdminConfig(cfg);
    _resetRuntimeCache();

    const sparks = findPodcastNuggetSparks(getTopics());
    expect(sparks.length).toBe(0);

    // And via the per-topic accessor.
    for (const seed of SEED_TOPICS) {
      const t = getTopic(seed.id);
      expect(t).toBeTruthy();
      if (!t) continue;
      const ps = findPodcastNuggetSparks([t]);
      expect(ps.length).toBe(0);
    }
  });

  it("flag flipping does not corrupt non-podcast Sparks (microread/tip/etc. are preserved)", () => {
    const totalBefore = SEED_TOPICS.flatMap((t) =>
      t.levels.flatMap((l) => l.sparks),
    ).length;
    const podcastCountBefore = findPodcastNuggetSparks(SEED_TOPICS).length;

    const cfg = defaultAdminConfig();
    cfg.flags.lennyContentEnabled = false;
    saveAdminConfig(cfg);
    _resetRuntimeCache();

    const filtered = getTopics();
    const totalAfter = filtered.flatMap((t) => t.levels.flatMap((l) => l.sparks)).length;
    expect(totalAfter).toBe(totalBefore - podcastCountBefore);
  });
});

describe("PodcastNugget — content schema integrity", () => {
  const sparks = findPodcastNuggetSparks(SEED_TOPICS);

  it("every nugget has a non-empty quote and takeaway", () => {
    expect(sparks.length).toBeGreaterThan(0);
    for (const s of sparks) {
      const ex = s.exercise as Extract<Exercise, { type: "podcastnugget" }>;
      expect(ex.quote.length).toBeGreaterThan(0);
      expect(ex.takeaway.length).toBeGreaterThan(0);
    }
  });

  it("every nugget quote is ≤ 60 words (curation rubric)", () => {
    for (const s of sparks) {
      const ex = s.exercise as Extract<Exercise, { type: "podcastnugget" }>;
      const wc = wordCount(ex.quote);
      expect(wc, `Spark "${s.title}" quote is ${wc} words`).toBeLessThanOrEqual(60);
    }
  });

  it("every nugget cites Lenny's Podcast and links to the root URL", () => {
    for (const s of sparks) {
      const ex = s.exercise as Extract<Exercise, { type: "podcastnugget" }>;
      expect(ex.source.podcast).toBe("Lenny's Podcast");
      expect(ex.source.podcastUrl).toBe(LENNY_ROOT);
      expect(ex.source.guest.length).toBeGreaterThan(0);
    }
  });

  it("nuggets cover the four target Constellations (ai-builder, ai-pm, ai-trends, frontier-companies)", () => {
    const targets = ["ai-builder", "ai-pm", "ai-trends", "frontier-companies"];
    const seen: Record<string, number> = {};
    for (const t of SEED_TOPICS) {
      for (const lvl of t.levels) {
        for (const s of lvl.sparks) {
          if (s.exercise.type === "podcastnugget") {
            seen[t.id] = (seen[t.id] ?? 0) + 1;
          }
        }
      }
    }
    for (const id of targets) {
      expect(seen[id], `Constellation ${id} should have ≥ 1 PodcastNugget`).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("PodcastNugget — renderer", () => {
  const ex: Extract<Exercise, { type: "podcastnugget" }> = {
    type: "podcastnugget",
    quote: "AI is going to change how we build software.",
    takeaway: "Adapt early.",
    source: {
      podcast: "Lenny's Podcast",
      podcastUrl: LENNY_ROOT,
      guest: "Test Guest",
      guestRole: "test role",
      episodeTitle: "Test episode",
      timestamp: "00:00:00",
    },
    ctaPrompt: "Try this thing.",
  };

  it("renders the podcast attribution chip linking to the podcast root", () => {
    render(
      <ExerciseRenderer exercise={ex} title="Test spark" onAnswer={() => {}} />,
    );
    const links = screen.getAllByRole("link") as HTMLAnchorElement[];
    expect(links.length).toBeGreaterThanOrEqual(2);
    for (const a of links) {
      expect(a.href).toBe(LENNY_ROOT);
      expect(a.target).toBe("_blank");
      expect(a.rel).toContain("noopener");
    }
  });

  it("renders the quote, takeaway, and CTA prompt", () => {
    render(
      <ExerciseRenderer exercise={ex} title="Test spark" onAnswer={() => {}} />,
    );
    expect(screen.getByText(/AI is going to change how we build software/i)).toBeTruthy();
    expect(screen.getByText(/Adapt early/i)).toBeTruthy();
    expect(screen.getByText(/Try this thing/i)).toBeTruthy();
  });

  it("anti-spam lock: clicking 'Got it' multiple times fires onAnswer exactly once", () => {
    const calls: { correct: boolean }[] = [];
    render(
      <ExerciseRenderer
        exercise={ex}
        title="Test spark"
        onAnswer={(correct) => calls.push({ correct })}
      />,
    );
    const btn = screen.getByRole("button", { name: /Got it/i });
    fireEvent.click(btn);
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(calls.length).toBe(1);
    expect(calls[0]?.correct).toBe(true);
  });

  it("guest line falls back to guest-only when guestRole is missing", () => {
    const slim: Extract<Exercise, { type: "podcastnugget" }> = {
      ...ex,
      source: { ...ex.source, guestRole: undefined },
    };
    render(
      <ExerciseRenderer exercise={slim} title="Test spark" onAnswer={() => {}} />,
    );
    expect(screen.getByText("Test Guest")).toBeTruthy();
  });
});

describe("PodcastNugget — XP wiring", () => {
  const ex: Extract<Exercise, { type: "podcastnugget" }> = {
    type: "podcastnugget",
    quote: "Quote.",
    takeaway: "Takeaway.",
    source: { podcast: "Lenny's Podcast", podcastUrl: LENNY_ROOT, guest: "G" },
  };

  it("awards tip-tier XP by default", () => {
    const xp = xpForExercise(ex, true);
    expect(xp).toBe(defaultAdminConfig().tuning.xp.tip);
  });

  it("respects bonusXP override on the spark", () => {
    const withBonus = { ...ex, bonusXP: 17 };
    expect(xpForExercise(withBonus, true)).toBe(17);
  });
});
