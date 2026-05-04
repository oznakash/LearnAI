import { useEffect, useState } from "react";
import { useMemory } from "./MemoryContext";
import type { MemoryItem } from "./types";
import type { PlayerState, Topic, TopicId } from "../types";
import { TOPICS } from "../content";

export interface Insight {
  /** The memory that drives this recommendation. */
  memory: MemoryItem;
  /** Topic the player should focus on next. */
  topicId: TopicId;
  /** Optional level inside that topic (when known). */
  levelIndex?: number;
  /** Pre-formatted reason ("you said: …", "you've been weak on …"). */
  reason: string;
}

/**
 * Goal-text aliases per topic. Free-text goals don't always contain the
 * literal Topic name — "Become an AI PM" should still map to `ai-pm` even
 * though that topic is officially "AI Product Management." Add aliases
 * defensively; false positives only re-bias the today-insight, they don't
 * gate any content.
 */
export const TOPIC_GOAL_ALIASES: Partial<Record<TopicId, readonly string[]>> = {
  "ai-pm": ["ai pm", "product manager", "product management", "pm role"],
  "ai-builder": ["ship ai", "build ai", "shipping ai", "ai feature", "ai product"],
  "llms-cognition": ["llm", "prompt", "prompting", "context window", "tokens"],
  "memory-safety": ["rag", "alignment", "guardrail", "memory layer"],
  "ai-foundations": ["fundamentals", "the basics", "what is ai", "how ai works"],
  "ai-devtools": ["claude code", "cursor", "copilot", "agentic ide"],
  "cybersecurity": ["security", "attack", "defense", "red team", "blue team"],
  "cloud": ["gpu", "inference cost", "hosting", "compute"],
  "ai-news": ["stay current", "weekly digest", "ai news"],
  "ai-trends": ["trend", "market", "what's coming"],
  "frontier-companies": ["openai", "anthropic", "google deepmind", "meta ai", "frontier lab"],
  "open-source": ["open-source", "open source", "huggingface", "hugging face"],
};

/**
 * Pure, testable reducer that turns a list of memories + the player's state
 * into a single recommendation. Heuristic order:
 *
 *   1. Most recent `goal` memory aligned with one of the user's interests.
 *   2. Most recent `gap` memory (turn it into "let's fix that").
 *   3. Most recent `preference` memory that mentions a topic.
 *   4. null  (Home falls back to its existing heuristic).
 */
export function pickInsight(
  memories: MemoryItem[],
  player: Pick<PlayerState, "profile">,
  topics: Topic[] = TOPICS
): Insight | null {
  if (!memories.length) return null;

  const interests: TopicId[] = player.profile?.interests ?? [];
  const sorted = [...memories].sort((a, b) => b.updatedAt - a.updatedAt);

  // Helper: match a memory to a topic via metadata.topicId, the topic's name
  // appearing in text, or a goal-alias fragment. The fallback is the first
  // *interest* whose alias appears in the text, then the first interest by
  // index — this tilts the today-insight toward what the user actually said
  // they care about rather than the alphabetical default.
  const matchTopic = (m: MemoryItem): { topicId: TopicId; levelIndex?: number } | null => {
    const meta = m.metadata as Record<string, unknown> | undefined;
    if (meta && typeof meta.topicId === "string" && topics.some((t) => t.id === meta.topicId)) {
      const levelIndex = typeof meta.levelIndex === "number" ? (meta.levelIndex as number) : undefined;
      return { topicId: meta.topicId as TopicId, levelIndex };
    }
    const lower = m.text.toLowerCase();
    // Direct topic-name match wins.
    for (const t of topics) {
      if (lower.includes(t.name.toLowerCase())) return { topicId: t.id };
    }
    // Alias match — prefer an alias that maps to one of the user's
    // interests so the recommendation stays inside their stated scope.
    const interestSet = new Set(interests);
    const aliasHit = (preferInterests: boolean): TopicId | null => {
      for (const [topicId, aliases] of Object.entries(TOPIC_GOAL_ALIASES) as [TopicId, readonly string[]][]) {
        if (preferInterests && !interestSet.has(topicId)) continue;
        if (aliases.some((a) => lower.includes(a))) return topicId;
      }
      return null;
    };
    const interestAlias = aliasHit(true);
    if (interestAlias) return { topicId: interestAlias };
    const anyAlias = aliasHit(false);
    if (anyAlias) return { topicId: anyAlias };
    // Last resort: the first interest the user picked.
    if (interests[0]) return { topicId: interests[0] };
    return null;
  };

  // (1) Most recent goal aligned with an interest.
  for (const m of sorted) {
    if (m.category !== "goal") continue;
    const t = matchTopic(m);
    if (t && (interests.length === 0 || interests.includes(t.topicId))) {
      return {
        memory: m,
        topicId: t.topicId,
        levelIndex: t.levelIndex,
        reason: `because you said: "${m.text.replace(/^Goal:\s*/i, "")}"`,
      };
    }
  }

  // (2) Most recent gap.
  for (const m of sorted) {
    if (m.category !== "gap") continue;
    const t = matchTopic(m);
    if (t) {
      return {
        memory: m,
        topicId: t.topicId,
        levelIndex: t.levelIndex,
        reason: `let's close a gap you flagged: "${m.text}"`,
      };
    }
  }

  // (3) Most recent preference that maps to a topic.
  for (const m of sorted) {
    if (m.category !== "preference") continue;
    const t = matchTopic(m);
    if (t && (interests.length === 0 || interests.includes(t.topicId))) {
      return {
        memory: m,
        topicId: t.topicId,
        reason: `because you told me: "${m.text}"`,
      };
    }
  }

  return null;
}

/**
 * React hook: lists the player's memories once, recomputes the Insight
 * whenever the player profile changes. Re-fetches if the underlying memory
 * service swaps (offline ↔ mem0).
 */
export function useTodayInsight(player: Pick<PlayerState, "profile">): {
  insight: Insight | null;
  loading: boolean;
} {
  const { list, backend } = useMemory();
  const [insight, setInsight] = useState<Insight | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    list({ limit: 100 }).then((items) => {
      if (cancelled) return;
      setInsight(pickInsight(items, player));
      setLoading(false);
    }).catch(() => {
      if (cancelled) return;
      setInsight(null);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [list, backend, player.profile?.interests, player.profile?.skillLevel, player.profile?.goal]);

  return { insight, loading };
}
