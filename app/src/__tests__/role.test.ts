import { describe, it, expect } from "vitest";
import {
  FLUENCY_PROBE,
  ROLE_LABEL,
  fluencyToSkill,
  probeScore,
  roleToSuggestedSkill,
  roleToSuggestedTopics,
  roleTopicOrder,
} from "../store/role";
import { TOPICS } from "../content";
import type { Role, TopicId } from "../types";

describe("roleToSuggestedTopics", () => {
  it("returns 4 topics by default for a known role", () => {
    expect(roleToSuggestedTopics("pm")).toHaveLength(4);
    expect(roleToSuggestedTopics("engineer")).toHaveLength(4);
  });

  it("returns an empty list when no role is set (back-compat)", () => {
    expect(roleToSuggestedTopics(undefined)).toEqual([]);
  });

  it("PM gets ai-pm at the front", () => {
    const topics = roleToSuggestedTopics("pm");
    expect(topics[0]).toBe("ai-pm");
  });

  it("Engineer gets ai-builder at the front", () => {
    const topics = roleToSuggestedTopics("engineer");
    expect(topics[0]).toBe("ai-builder");
  });

  it("Researcher gets the deep topics first", () => {
    const topics = roleToSuggestedTopics("researcher");
    // The first three should be the ones that match the researcher's
    // shape — cognition / safety / trends, not foundations.
    expect(topics).toContain("llms-cognition");
    expect(topics).not.toContain("ai-foundations");
  });

  it("Student / kid gets foundations + news first", () => {
    const topics = roleToSuggestedTopics("student");
    expect(topics[0]).toBe("ai-foundations");
    expect(topics).toContain("ai-news");
  });

  it("only references topic ids that exist in the seed", () => {
    const known = new Set<TopicId>(TOPICS.map((t) => t.id));
    const roles: Role[] = [
      "student",
      "pm",
      "engineer",
      "designer",
      "creator",
      "exec",
      "researcher",
      "curious",
      "other",
    ];
    for (const r of roles) {
      for (const t of roleTopicOrder(r)) {
        expect(known.has(t)).toBe(true);
      }
    }
  });

  it("respects the custom n parameter", () => {
    expect(roleToSuggestedTopics("pm", 2)).toHaveLength(2);
    expect(roleToSuggestedTopics("pm", 1)).toHaveLength(1);
  });
});

describe("roleToSuggestedSkill", () => {
  it("Engineer suggests builder", () => {
    expect(roleToSuggestedSkill("engineer")).toBe("builder");
  });
  it("Researcher suggests architect", () => {
    expect(roleToSuggestedSkill("researcher")).toBe("architect");
  });
  it("PM suggests explorer", () => {
    expect(roleToSuggestedSkill("pm")).toBe("explorer");
  });
  it("Student / curious / undefined suggests starter", () => {
    expect(roleToSuggestedSkill("student")).toBe("starter");
    expect(roleToSuggestedSkill("curious")).toBe("starter");
    expect(roleToSuggestedSkill(undefined)).toBe("starter");
  });
});

describe("fluencyToSkill", () => {
  it("0 → starter", () => expect(fluencyToSkill(0)).toBe("starter"));
  it("1 → explorer", () => expect(fluencyToSkill(1)).toBe("explorer"));
  it("2 → explorer", () => expect(fluencyToSkill(2)).toBe("explorer"));
  it("3 → builder", () => expect(fluencyToSkill(3)).toBe("builder"));
  it("4 → architect", () => expect(fluencyToSkill(4)).toBe("architect"));
  it("clamps absurdly large fluency to architect", () => {
    expect(fluencyToSkill(99)).toBe("architect");
  });
});

describe("probeScore", () => {
  it("returns 0 for an empty / undefined answer set", () => {
    expect(probeScore([])).toBe(0);
  });

  it("sums per-question scores", () => {
    // q1: "Regularly" (score 2). q2: "I ship code" (score 2). → 4
    expect(probeScore([2, 2])).toBe(4);
  });

  it("handles partial answers (only first question answered)", () => {
    expect(probeScore([1])).toBe(1);
  });

  it("ignores out-of-range indexes defensively", () => {
    expect(probeScore([99, 99])).toBe(0);
  });

  it("clamps to the 0..4 band", () => {
    // Each option is at most 2; two questions; max = 4. Already enforced
    // by the option scores themselves, but the helper is explicit about
    // the clamp so a future option re-balance can't surprise consumers.
    const max = FLUENCY_PROBE.reduce(
      (a, q) => a + Math.max(...q.options.map((o) => o.score)),
      0
    );
    expect(max).toBeLessThanOrEqual(4);
    expect(probeScore([2, 2])).toBe(4);
  });
});

describe("ROLE_LABEL", () => {
  it("has a label entry for every Role", () => {
    const roles: Role[] = [
      "student",
      "pm",
      "engineer",
      "designer",
      "creator",
      "exec",
      "researcher",
      "curious",
      "other",
    ];
    for (const r of roles) {
      const entry = ROLE_LABEL[r];
      expect(entry).toBeDefined();
      expect(entry.label.length).toBeGreaterThan(0);
      expect(entry.emoji.length).toBeGreaterThan(0);
      expect(entry.sub.length).toBeGreaterThan(0);
    }
  });
});
