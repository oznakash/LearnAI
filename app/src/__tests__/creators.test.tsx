import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ExerciseRenderer } from "../components/Exercise";
import { ADMIN_STORAGE_KEY, loadAdminConfig, saveAdminConfig } from "../admin/store";
import { defaultAdminConfig } from "../admin/defaults";
import {
  _resetRuntimeCache,
  getCreator,
  getRuntimeCreators,
} from "../admin/runtime";
import { SEED_CREATORS } from "../content/creators";
import { SEED_TOPICS } from "../content";
import type { Exercise, Creator } from "../types";

const LENNY_ROOT = "https://www.lennysnewsletter.com/podcast";

beforeEach(() => {
  window.localStorage.clear();
  _resetRuntimeCache();
});
afterEach(() => {
  window.localStorage.clear();
  _resetRuntimeCache();
});

describe("Creator registry — seed defaults", () => {
  it("ships with at least one seed creator (Lenny)", () => {
    expect(SEED_CREATORS.lenny).toBeDefined();
    expect(SEED_CREATORS.lenny.kind).toBe("podcast");
    expect(SEED_CREATORS.lenny.creditUrl).toBe(LENNY_ROOT);
    expect(SEED_CREATORS.lenny.creditLabel).toMatch(/Lenny/i);
  });

  it("default admin config carries the seed creators", () => {
    const cfg = defaultAdminConfig();
    expect(cfg.creators.lenny).toBeDefined();
    expect(cfg.creators.lenny.id).toBe("lenny");
  });

  it("getRuntimeCreators() returns seeds when no admin config is saved", () => {
    expect(getRuntimeCreators().lenny).toBeDefined();
    expect(getCreator("lenny")?.creditUrl).toBe(LENNY_ROOT);
  });

  it("getCreator returns undefined for unknown ids", () => {
    expect(getCreator(undefined)).toBeUndefined();
    expect(getCreator("nope-not-here")).toBeUndefined();
  });
});

describe("Creator registry — admin store forward-compat", () => {
  it("legacy saved configs without `creators` load with seed defaults merged in", () => {
    const legacy = {
      bootstrapped: true,
      admins: ["maya@gmail.com"],
      flags: { allowDemoMode: true },
      // no `creators` field at all
    };
    window.localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(legacy));
    const cfg = loadAdminConfig();
    expect(cfg.creators.lenny).toBeDefined();
    expect(cfg.creators.lenny.creditUrl).toBe(LENNY_ROOT);
  });

  it("operator-saved overrides win on collisions but seeds still appear", () => {
    const cfg = defaultAdminConfig();
    cfg.creators.lenny = {
      ...cfg.creators.lenny,
      name: "Lenny — fork edition",
      creditUrl: "https://example.com/forked",
    };
    cfg.creators["hard-fork"] = {
      id: "hard-fork",
      name: "Hard Fork",
      kind: "podcast",
      avatarEmoji: "🎤",
      creditUrl: "https://www.nytimes.com/column/hard-fork",
      creditLabel: "Listen on Hard Fork",
    };
    saveAdminConfig(cfg);
    _resetRuntimeCache();

    const live = getRuntimeCreators();
    expect(live.lenny.name).toBe("Lenny — fork edition");
    expect(live.lenny.creditUrl).toBe("https://example.com/forked");
    expect(live["hard-fork"]).toBeDefined();
    expect(live["hard-fork"].name).toBe("Hard Fork");
  });
});

describe("PodcastNugget — credit resolved from creator registry", () => {
  it("renders the creator's name + creditUrl + creditLabel when creatorId is set", () => {
    const cfg = defaultAdminConfig();
    cfg.creators["hard-fork"] = {
      id: "hard-fork",
      name: "Hard Fork",
      kind: "podcast",
      avatarEmoji: "🎤",
      creditUrl: "https://www.nytimes.com/column/hard-fork",
      creditLabel: "Listen on Hard Fork",
    };
    saveAdminConfig(cfg);
    _resetRuntimeCache();

    const ex: Extract<Exercise, { type: "podcastnugget" }> = {
      type: "podcastnugget",
      creatorId: "hard-fork",
      quote: "AI changes how products get built.",
      takeaway: "Adapt early.",
      source: {
        // Inline source values are intentionally stale — registry should win.
        podcast: "OUTDATED PODCAST NAME",
        podcastUrl: "https://outdated.example.com/",
        guest: "Some Guest",
      },
    };

    render(
      <ExerciseRenderer exercise={ex} title="Test spark" onAnswer={() => {}} />
    );

    expect(screen.queryByText(/OUTDATED/i)).toBeNull();
    expect(screen.getByText("Hard Fork")).toBeTruthy();
    expect(screen.getByText(/Listen on Hard Fork/i)).toBeTruthy();
    const links = screen.getAllByRole("link") as HTMLAnchorElement[];
    for (const a of links) {
      expect(a.href).toBe("https://www.nytimes.com/column/hard-fork");
    }
  });

  it("falls back to inline source when creatorId is missing or unknown", () => {
    const ex: Extract<Exercise, { type: "podcastnugget" }> = {
      type: "podcastnugget",
      // creatorId omitted — back-compat path
      quote: "Quote here.",
      takeaway: "Adapt.",
      source: {
        podcast: "Lenny's Podcast",
        podcastUrl: LENNY_ROOT,
        guest: "Boris",
      },
    };

    render(
      <ExerciseRenderer exercise={ex} title="Test spark" onAnswer={() => {}} />
    );

    expect(screen.getByText("Lenny's Podcast")).toBeTruthy();
    expect(screen.getByText(/Listen on Lenny's Podcast/i)).toBeTruthy();
    const links = screen.getAllByRole("link") as HTMLAnchorElement[];
    for (const a of links) expect(a.href).toBe(LENNY_ROOT);
  });
});

describe("PodcastNugget — seed nuggets reference the lenny creator", () => {
  it("every seed PodcastNugget points at a creator that resolves in the registry", () => {
    let seen = 0;
    for (const t of SEED_TOPICS) {
      for (const lvl of t.levels) {
        for (const sp of lvl.sparks) {
          if (sp.exercise.type !== "podcastnugget") continue;
          seen += 1;
          expect(sp.exercise.creatorId, `Spark "${sp.title}" missing creatorId`).toBe("lenny");
          const creator: Creator | undefined = getCreator(sp.exercise.creatorId);
          expect(creator).toBeDefined();
          expect(creator?.creditUrl).toBe(LENNY_ROOT);
        }
      }
    }
    expect(seen).toBeGreaterThanOrEqual(12);
  });
});

describe("Exercise renderer — anti-spam still works after creator wiring", () => {
  it("Got it ⚡ fires onAnswer exactly once even with creatorId set", () => {
    const ex: Extract<Exercise, { type: "podcastnugget" }> = {
      type: "podcastnugget",
      creatorId: "lenny",
      quote: "Quote.",
      takeaway: "Takeaway.",
      source: { podcast: "Lenny's Podcast", podcastUrl: LENNY_ROOT, guest: "Boris" },
    };
    const calls: { correct: boolean }[] = [];
    render(
      <ExerciseRenderer
        exercise={ex}
        title="Test"
        onAnswer={(correct) => calls.push({ correct })}
      />
    );
    const btn = screen.getByRole("button", { name: /Got it/i });
    fireEvent.click(btn);
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(calls.length).toBe(1);
    expect(calls[0]?.correct).toBe(true);
  });
});
