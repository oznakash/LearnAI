import { describe, it, expect } from "vitest";
import { allTopicChoices, buildGenerationPrompt } from "../content/prompt";

describe("buildGenerationPrompt", () => {
  const opts = {
    topicName: "AI Foundations",
    topicTagline: "What AI is, how it learns, and why it works.",
    level: 3,
    count: 4,
    audience: "Active AI builders + curious starters.",
  };

  it("contains the topic, level, audience, and count", () => {
    const p = buildGenerationPrompt(opts);
    expect(p).toContain("AI Foundations");
    expect(p).toContain("Level 3");
    expect(p).toContain("4 bite-sized");
    expect(p).toContain("Active AI builders");
  });

  it("includes the JSON schema for every Spark variant", () => {
    const p = buildGenerationPrompt(opts);
    for (const key of [
      `"type": "microread"`,
      `"type": "tip"`,
      `"type": "quickpick"`,
      `"type": "fillstack"`,
      `"type": "scenario"`,
      `"type": "patternmatch"`,
      `"type": "buildcard"`,
    ]) {
      expect(p).toContain(key);
    }
  });

  it("appends custom instructions when provided", () => {
    const p = buildGenerationPrompt({ ...opts, customNote: "include vendor-neutral examples." });
    expect(p).toContain("include vendor-neutral examples.");
  });

  it("ends with a strict 'JSON only' directive", () => {
    const p = buildGenerationPrompt(opts);
    expect(p).toMatch(/JSON object/i);
    expect(p).toMatch(/no preamble/i);
  });
});

describe("allTopicChoices", () => {
  it("returns 12 seeded topics", () => {
    expect(allTopicChoices()).toHaveLength(12);
  });

  it("each entry has id, name, tagline", () => {
    for (const c of allTopicChoices()) {
      expect(c.id).toBeTruthy();
      expect(c.name).toBeTruthy();
      expect(c.tagline).toBeTruthy();
    }
  });
});
