import { describe, it, expect } from "vitest";
import { pickIntentCTA, INTENT_PRIORITY } from "../store/intent";
import type { Intent } from "../types";

describe("pickIntentCTA — Level-Cleared secondary CTA", () => {
  it("returns null when no intent is set", () => {
    expect(pickIntentCTA(undefined, "ai-pm")).toBeNull();
    expect(pickIntentCTA([], "ai-pm")).toBeNull();
  });

  it("applied → ai-builder topic switch", () => {
    const cta = pickIntentCTA(["applied"], "ai-pm");
    expect(cta).not.toBeNull();
    expect(cta!.intent).toBe("applied");
    expect(cta!.topicId).toBe("ai-builder");
    expect(cta!.externalUrl).toBeNull();
    expect(cta!.label).toContain("🛠");
    expect(cta!.label).toMatch(/Build Card/i);
  });

  it("decision → ai-pm topic switch", () => {
    const cta = pickIntentCTA(["decision"], "ai-builder");
    expect(cta!.topicId).toBe("ai-pm");
    expect(cta!.label).toContain("🧪");
  });

  it("curious → ai-foundations topic switch", () => {
    const cta = pickIntentCTA(["curious"], "ai-pm");
    expect(cta!.topicId).toBe("ai-foundations");
    expect(cta!.label).toContain("📖");
  });

  it("researcher → ai-news topic switch", () => {
    const cta = pickIntentCTA(["researcher"], "ai-pm");
    expect(cta!.topicId).toBe("ai-news");
    expect(cta!.label).toContain("📰");
  });

  it("forker → external fork-recipe URL, no topic switch", () => {
    const cta = pickIntentCTA(["forker"], "ai-pm");
    expect(cta!.topicId).toBeNull();
    expect(cta!.externalUrl).toContain("fork-recipe.md");
    expect(cta!.label).toContain("🌐");
  });

  it("priority — applied beats decision when both are set", () => {
    const cta = pickIntentCTA(["decision", "applied"], "ai-news");
    expect(cta!.intent).toBe("applied");
  });

  it("priority — order is applied > decision > curious > researcher > forker", () => {
    expect(INTENT_PRIORITY).toEqual([
      "applied",
      "decision",
      "curious",
      "researcher",
      "forker",
    ]);
    // Sample: every-mode user lands on applied first.
    const all: Intent[] = ["forker", "researcher", "curious", "decision", "applied"];
    expect(pickIntentCTA(all, "ai-news")!.intent).toBe("applied");
  });

  it("falls through when the top-priority intent's topic is the current topic", () => {
    // User is *applied* AND already on ai-builder. We don't want to
    // send them back to ai-builder; advance to the next priority.
    const cta = pickIntentCTA(["applied", "decision"], "ai-builder");
    expect(cta!.intent).toBe("decision");
    expect(cta!.topicId).toBe("ai-pm");
  });

  it("returns null when the only intent points at the current topic", () => {
    const cta = pickIntentCTA(["applied"], "ai-builder");
    expect(cta).toBeNull();
  });

  it("forker is honored even if the user is on the open-source topic (it's an external link, never a topic switch)", () => {
    const cta = pickIntentCTA(["forker"], "open-source");
    expect(cta).not.toBeNull();
    expect(cta!.topicId).toBeNull();
    expect(cta!.externalUrl).toContain("fork-recipe.md");
  });
});
