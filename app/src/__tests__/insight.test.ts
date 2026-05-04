import { describe, it, expect } from "vitest";
import { pickInsight } from "../memory/insight";
import { TOPICS } from "../content";
import type { MemoryItem } from "../memory/types";
import type { PlayerProfile } from "../types";

const baseProfile: PlayerProfile = {
  name: "Alex",
  ageBand: "adult",
  skillLevel: "explorer",
  interests: ["ai-builder", "ai-pm"],
  dailyMinutes: 10,
  goal: "Ship my first AI feature",
  experience: "PM",
  createdAt: 0,
};

const mem = (over: Partial<MemoryItem>): MemoryItem => ({
  id: `m-${Math.random()}`,
  text: over.text ?? "",
  category: over.category,
  metadata: over.metadata,
  createdAt: over.createdAt ?? 0,
  updatedAt: over.updatedAt ?? over.createdAt ?? 0,
});

describe("pickInsight", () => {
  it("returns null when there are no memories", () => {
    expect(pickInsight([], { profile: baseProfile })).toBeNull();
  });

  it("returns null when memories exist but don't match any topic + interests", () => {
    const memories = [
      mem({
        text: "Likes the color teal",
        category: "preference",
        updatedAt: 100,
      }),
    ];
    // No metadata.topicId, no topic name in text → cannot map.
    // Interests fallback applies, so "preference" still maps to first interest.
    const r = pickInsight(memories, { profile: { ...baseProfile, interests: [] } });
    expect(r).toBeNull();
  });

  it("prefers a goal memory aligned with an interest", () => {
    const memories = [
      mem({ text: "Loves pgvector", category: "preference", updatedAt: 200 }),
      mem({
        text: "Goal: ship an AI Builder demo",
        category: "goal",
        updatedAt: 100,
        metadata: { topicId: "ai-builder" },
      }),
    ];
    const r = pickInsight(memories, { profile: baseProfile });
    expect(r).not.toBeNull();
    expect(r!.topicId).toBe("ai-builder");
    expect(r!.reason).toContain("you said");
    expect(r!.reason).toContain("ship an AI Builder demo");
  });

  it("falls back to gap memory when no aligned goal exists", () => {
    const memories = [
      mem({
        text: "Struggling on prompt caching",
        category: "gap",
        updatedAt: 50,
        metadata: { topicId: "ai-builder" },
      }),
    ];
    const r = pickInsight(memories, { profile: baseProfile });
    expect(r).not.toBeNull();
    expect(r!.topicId).toBe("ai-builder");
    expect(r!.reason).toContain("close a gap");
  });

  it("falls back to preference memory mentioning a topic", () => {
    const memories = [
      mem({
        text: `Wants more of ${TOPICS[0].name}`,
        category: "preference",
        updatedAt: 30,
      }),
    ];
    const r = pickInsight(memories, {
      profile: { ...baseProfile, interests: [TOPICS[0].id] },
    });
    expect(r).not.toBeNull();
    expect(r!.topicId).toBe(TOPICS[0].id);
  });

  it("uses metadata.topicId over text matching when both are present", () => {
    const memories = [
      mem({
        text: "Goal: master AI Builder",
        category: "goal",
        updatedAt: 100,
        metadata: { topicId: "ai-pm" }, // metadata wins
      }),
    ];
    const r = pickInsight(memories, { profile: baseProfile });
    expect(r!.topicId).toBe("ai-pm");
  });

  it("preserves levelIndex from metadata when present", () => {
    const memories = [
      mem({
        text: "Goal: get to AI Builder L5",
        category: "goal",
        updatedAt: 100,
        metadata: { topicId: "ai-builder", levelIndex: 5 },
      }),
    ];
    const r = pickInsight(memories, { profile: baseProfile });
    expect(r!.levelIndex).toBe(5);
  });

  it("strips the 'Goal: ' prefix from the reason text", () => {
    const memories = [
      mem({
        text: "Goal: ship it",
        category: "goal",
        updatedAt: 100,
        metadata: { topicId: "ai-builder" },
      }),
    ];
    const r = pickInsight(memories, { profile: baseProfile });
    expect(r!.reason).toContain('"ship it"');
    expect(r!.reason).not.toMatch(/Goal:/i);
  });

  it("picks the most recent memory when there are ties on category", () => {
    const older = mem({
      text: "Goal: older goal",
      category: "goal",
      updatedAt: 10,
      metadata: { topicId: "ai-builder" },
    });
    const newer = mem({
      text: "Goal: newer goal",
      category: "goal",
      updatedAt: 1000,
      metadata: { topicId: "ai-builder" },
    });
    const r = pickInsight([older, newer], { profile: baseProfile });
    expect(r!.memory.text).toBe("Goal: newer goal");
  });

  it("ignores goal memories that map to a topic outside the user's interests", () => {
    const memories = [
      mem({
        text: "Goal: deep dive into cybersecurity",
        category: "goal",
        updatedAt: 100,
        metadata: { topicId: "cybersecurity" },
      }),
    ];
    // Interests does NOT include cybersecurity → goal is skipped, no fallback.
    const r = pickInsight(memories, {
      profile: { ...baseProfile, interests: ["ai-builder"] },
    });
    expect(r).toBeNull();
  });

  describe("goal-text aliases", () => {
    it("maps 'Become an AI PM' to ai-pm even though the topic name is 'AI Product Management'", () => {
      const memories = [
        mem({
          // No metadata — only the alias gets us there.
          text: "Goal: Become an AI PM",
          category: "goal",
          updatedAt: 100,
        }),
      ];
      // ai-pm is in the interest list.
      const r = pickInsight(memories, {
        profile: { ...baseProfile, interests: ["ai-foundations", "ai-pm"] },
      });
      expect(r).not.toBeNull();
      expect(r!.topicId).toBe("ai-pm");
    });

    it("prefers an alias whose topic is in the user's interests over one that isn't", () => {
      const memories = [
        mem({
          // "ship" matches `ai-builder` aliases AND nothing else; the user's
          // interests *include* ai-builder, so we should land there.
          text: "Goal: ship an AI feature this quarter",
          category: "goal",
          updatedAt: 100,
        }),
      ];
      const r = pickInsight(memories, {
        profile: {
          ...baseProfile,
          interests: ["ai-builder", "ai-pm"],
        },
      });
      expect(r).not.toBeNull();
      expect(r!.topicId).toBe("ai-builder");
    });

    it("falls back to first interest only when no alias matches", () => {
      const memories = [
        mem({
          // No alias hits, no topic name in text.
          text: "Goal: get more confident",
          category: "goal",
          updatedAt: 100,
        }),
      ];
      const r = pickInsight(memories, {
        profile: { ...baseProfile, interests: ["ai-builder", "ai-pm"] },
      });
      expect(r).not.toBeNull();
      expect(r!.topicId).toBe("ai-builder"); // first interest
    });
  });
});
