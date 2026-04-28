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

  // Helper: match a memory to a topic via metadata.topicId, or a topic name in
  // its text (case-insensitive).
  const matchTopic = (m: MemoryItem): { topicId: TopicId; levelIndex?: number } | null => {
    const meta = m.metadata as Record<string, unknown> | undefined;
    if (meta && typeof meta.topicId === "string" && topics.some((t) => t.id === meta.topicId)) {
      const levelIndex = typeof meta.levelIndex === "number" ? (meta.levelIndex as number) : undefined;
      return { topicId: meta.topicId as TopicId, levelIndex };
    }
    const lower = m.text.toLowerCase();
    for (const t of topics) {
      if (lower.includes(t.name.toLowerCase())) return { topicId: t.id };
    }
    // Fall back to the first interest the user picked.
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
