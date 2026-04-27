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

export const TOPICS: Topic[] = [
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

export const TOPIC_MAP: Record<TopicId, Topic> = TOPICS.reduce(
  (acc, t) => {
    acc[t.id] = t;
    return acc;
  },
  {} as Record<TopicId, Topic>
);

export function getTopic(id: TopicId): Topic | undefined {
  return TOPIC_MAP[id];
}
