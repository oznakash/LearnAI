import type { Topic, TopicId } from "../types";
import { aiFoundations } from "./topics/ai-foundations";
import { llmsCognition } from "./topics/llms-cognition";
import { memorySafety } from "./topics/memory-safety";
import { aiPm } from "./topics/ai-pm";
import { aiBuilder } from "./topics/ai-builder";
import { cybersecurity } from "./topics/cybersecurity";
import { cloud } from "./topics/cloud";
import { aiDevtools } from "./topics/ai-devtools";
import { aiTrends } from "./topics/ai-trends";
import { frontierCompanies } from "./topics/frontier-companies";
import { aiNews } from "./topics/ai-news";
import { openSource } from "./topics/open-source";
import { getRuntimeContentOverrides, isLennyContentEnabled } from "../admin/runtime";

export const SEED_TOPICS: Topic[] = [
  aiFoundations,
  llmsCognition,
  memorySafety,
  aiPm,
  aiBuilder,
  cybersecurity,
  cloud,
  aiDevtools,
  aiTrends,
  frontierCompanies,
  aiNews,
  openSource,
];

/**
 * Strips every PodcastNugget Spark from a topic. Used when the
 * `flags.lennyContentEnabled` admin flag is false. We rebuild each
 * level's `sparks` array so referential equality is preserved when no
 * filtering is needed (see `applyContentFlags`).
 */
function stripPodcastNuggets(t: Topic): Topic {
  let changed = false;
  const filteredLevels = t.levels.map((lvl) => {
    const filtered = lvl.sparks.filter((s) => s.exercise.type !== "podcastnugget");
    if (filtered.length === lvl.sparks.length) return lvl;
    changed = true;
    return { ...lvl, sparks: filtered };
  });
  return changed ? { ...t, levels: filteredLevels } : t;
}

/**
 * Apply runtime feature flags that affect content shape. Today this is
 * just the Lenny's Podcast content seam (PodcastNugget Sparks), but the
 * shape is set up for future seams (e.g. talk-archive nuggets).
 *
 * Returns the input topic unchanged when no flags require filtering, so
 * callers that compare references stay stable in the common case.
 */
function applyContentFlags(t: Topic): Topic {
  if (!isLennyContentEnabled()) {
    return stripPodcastNuggets(t);
  }
  return t;
}

/**
 * Returns the live topic list, with admin-applied overrides (replacements
 * by id) and any extra admin-added topics merged in. Overrides win.
 * Then applies feature-flag-driven content filtering (e.g. stripping
 * PodcastNugget Sparks when `flags.lennyContentEnabled` is false).
 */
function buildTopics(): Topic[] {
  const overrides = getRuntimeContentOverrides();
  const map: Record<string, Topic> = {};
  for (const t of SEED_TOPICS) map[t.id] = t;
  for (const [id, t] of Object.entries(overrides.topics)) {
    if (t) map[id] = t;
  }
  for (const t of overrides.extras) {
    map[t.id] = t;
  }
  return Object.values(map).map(applyContentFlags);
}

/**
 * `TOPICS` is the seed-only list (stable for tests + first paint).
 * Use {@link getTopics} for the merged list that respects admin overrides
 * and runtime content flags.
 */
export const TOPICS: Topic[] = SEED_TOPICS;

export function getTopics(): Topic[] {
  return buildTopics();
}

export const TOPIC_MAP: Record<TopicId, Topic> = SEED_TOPICS.reduce(
  (acc, t) => {
    acc[t.id] = t;
    return acc;
  },
  {} as Record<TopicId, Topic>
);

export function getTopic(id: TopicId): Topic | undefined {
  // Prefer override from current admin config.
  const overrides = getRuntimeContentOverrides();
  let topic: Topic | undefined;
  if (overrides.topics[id]) topic = overrides.topics[id];
  else {
    for (const t of overrides.extras) if (t.id === id) topic = t;
  }
  if (!topic) topic = TOPIC_MAP[id];
  if (!topic) return undefined;
  return applyContentFlags(topic);
}
