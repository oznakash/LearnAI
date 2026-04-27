import { describe, it, expect, beforeEach } from "vitest";
import { tierForXP, xpForExercise, regenFocus, defaultState, MAX_FOCUS } from "../store/game";
import type { Exercise } from "../types";
import { ADMIN_STORAGE_KEY } from "../admin/store";
import { _resetRuntimeCache, getRuntimeTuning } from "../admin/runtime";

const microread: Exercise = { type: "microread", title: "t", body: "b", takeaway: "t" };
const quickpick: Exercise = { type: "quickpick", prompt: "p", options: ["a", "b"], answer: 0, explain: "e" };

beforeEach(() => {
  localStorage.removeItem(ADMIN_STORAGE_KEY);
  _resetRuntimeCache();
});

describe("Admin tuning at runtime", () => {
  it("falls back to defaults when no admin config is set", () => {
    expect(xpForExercise(microread, true)).toBe(8);
    expect(xpForExercise(quickpick, true)).toBe(12);
    expect(xpForExercise(quickpick, false)).toBe(4);
    expect(tierForXP(0)).toBe("Builder");
    expect(tierForXP(100)).toBe("Architect");
    expect(tierForXP(5000)).toBe("Singularity");
  });

  it("XP awards follow the admin tuning when set", () => {
    localStorage.setItem(
      ADMIN_STORAGE_KEY,
      JSON.stringify({
        tuning: { xp: { microread: 99, quickpickCorrect: 50, quickpickWrong: 7 } },
      })
    );
    _resetRuntimeCache();
    expect(xpForExercise(microread, true)).toBe(99);
    expect(xpForExercise(quickpick, true)).toBe(50);
    expect(xpForExercise(quickpick, false)).toBe(7);
  });

  it("tier thresholds follow the admin tuning when set", () => {
    localStorage.setItem(
      ADMIN_STORAGE_KEY,
      JSON.stringify({
        tuning: { tiers: { architect: 50, visionary: 200, founder: 800, singularity: 3000 } },
      })
    );
    _resetRuntimeCache();
    expect(tierForXP(49)).toBe("Builder");
    expect(tierForXP(50)).toBe("Architect");
    expect(tierForXP(200)).toBe("Visionary");
    expect(tierForXP(800)).toBe("Founder");
    expect(tierForXP(3000)).toBe("Singularity");
  });

  it("regenFocus respects admin-tuned max + regen interval", () => {
    localStorage.setItem(
      ADMIN_STORAGE_KEY,
      JSON.stringify({
        tuning: { focus: { max: 8, regenMinutes: 5 } },
      })
    );
    _resetRuntimeCache();
    const s = { ...defaultState(), focus: 0, focusUpdatedAt: 0 };
    const after = regenFocus(s, 5 * 60 * 1000 * 4); // 4 regen windows
    expect(after.focus).toBe(4);
  });

  it("getRuntimeTuning merges defaults safely on partial config", () => {
    localStorage.setItem(
      ADMIN_STORAGE_KEY,
      JSON.stringify({ tuning: { xp: { microread: 1 } } })
    );
    _resetRuntimeCache();
    const t = getRuntimeTuning();
    // overridden:
    expect(t.xp.microread).toBe(1);
    // defaults preserved:
    expect(t.xp.tip).toBe(5);
    expect(t.tiers.architect).toBe(100);
    expect(t.focus.max).toBe(MAX_FOCUS);
  });
});
