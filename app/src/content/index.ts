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
import { getRuntimeContentOverrides } from "../admin/runtime";

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
 * Returns the live topic list, with admin-applied overrides (replacements
 * by id) and any extra admin-added topics merged in. Overrides win.
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
  return Object.values(map);
}

/**
 * `TOPICS` is the seed-only list (stable for tests + first paint).
 * Use {@link getTopics} for the merged list that respects admin overrides.
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
  if (overrides.topics[id]) return overrides.topics[id];
  for (const t of overrides.extras) if (t.id === id) return t;
  return TOPIC_MAP[id];
}
