/**
 * Role-aware onboarding helpers.
 *
 * The wizard captures a `Role` early so downstream steps (topic pre-select,
 * skill suggestion, tone) can be opinionated about what makes sense for
 * *this kind of user*, rather than presenting all 12 Constellations as a
 * cold uniform grid. See `docs/aha-and-network.md` (FTUE) for the rationale.
 *
 * All functions are pure — no DOM, no globals — so they're trivially
 * testable and reusable from the recommender later.
 */

import type { Role, SkillLevel, TopicId } from "../types";

/**
 * Per-role topic suggestion order. The first 3-4 topics are pre-checked
 * in the interests step; the rest are reachable via "Show more." The
 * order here is the *display* order (most-relevant → least), so the
 * preview-spark picker can take the head of the list when no interest is
 * picked yet.
 *
 * Intentionally opinionated. A PM doesn't need pgvector specifics on day
 * one; an engineer doesn't need stakeholder framing first. We can be
 * wrong — the user can override — but a curated start beats a flat list.
 */
const ROLE_TO_TOPICS: Record<Role, readonly TopicId[]> = {
  student: [
    "ai-foundations",
    "ai-news",
    "ai-trends",
    "frontier-companies",
    "open-source",
  ],
  pm: [
    "ai-pm",
    "ai-trends",
    "ai-news",
    "frontier-companies",
    "ai-foundations",
  ],
  engineer: [
    "ai-builder",
    "ai-devtools",
    "llms-cognition",
    "memory-safety",
    "cloud",
    "open-source",
  ],
  designer: [
    "ai-foundations",
    "ai-pm",
    "ai-trends",
    "ai-builder",
    "ai-news",
  ],
  creator: [
    "ai-foundations",
    "ai-news",
    "ai-trends",
    "ai-builder",
    "frontier-companies",
  ],
  exec: [
    "ai-trends",
    "frontier-companies",
    "ai-news",
    "ai-pm",
    "cybersecurity",
  ],
  researcher: [
    "llms-cognition",
    "memory-safety",
    "ai-trends",
    "frontier-companies",
    "open-source",
    "ai-news",
  ],
  curious: [
    "ai-foundations",
    "ai-news",
    "ai-trends",
    "frontier-companies",
  ],
  other: [
    "ai-foundations",
    "ai-news",
    "ai-builder",
    "ai-pm",
  ],
};

/**
 * The N topics we should pre-check on the interests step for this role.
 * Defaults to 4 — enough breadth to feel like *we* picked, narrow enough
 * to be a confident start. The user can untick or add more.
 */
export function roleToSuggestedTopics(role: Role | undefined, n = 4): TopicId[] {
  if (!role) return [];
  return ROLE_TO_TOPICS[role].slice(0, n) as TopicId[];
}

/** Full ordered list of topic suggestions for a role — used for "more" sort. */
export function roleTopicOrder(role: Role | undefined): TopicId[] {
  if (!role) return [];
  return [...ROLE_TO_TOPICS[role]] as TopicId[];
}

/**
 * Default skill level we *suggest* for a role. The user's explicit pick
 * always wins. Conservative — when in doubt, suggest a level that leaves
 * room to be impressed rather than bored.
 *
 *   - student / curious / other  → starter
 *   - designer / creator / exec  → explorer (some context, low jargon)
 *   - pm                         → explorer (PM has read about AI, may not have built)
 *   - engineer                   → builder (assumes shipping experience)
 *   - researcher                 → architect (assumes systems thinking)
 */
export function roleToSuggestedSkill(role: Role | undefined): SkillLevel {
  switch (role) {
    case "engineer":
      return "builder";
    case "researcher":
      return "architect";
    case "pm":
    case "designer":
    case "creator":
    case "exec":
      return "explorer";
    case "student":
    case "curious":
    case "other":
    default:
      return "starter";
  }
}

/**
 * Map the AI-fluency probe (0..4) to a skill level. The probe is two
 * yes/no questions:
 *
 *   - q1: "Have you chatted with ChatGPT, Claude, or Gemini before?"
 *   - q2: "Have you written code, a script, or a custom prompt before?"
 *
 * Each yes is +1; an extra "yes, often / yes, daily" intensifier is +2.
 * Total score:
 *
 *   0 — neither → starter (we go very gentle)
 *   1 — used a chatbot once or twice → explorer
 *   2 — used regularly OR can write a prompt → explorer
 *   3 — fluent + has written code → builder
 *   4 — fluent + builds AI things → architect (rare from probe alone)
 *
 * The output is a sensible starting *suggestion*; the user's explicit
 * skill self-report still wins. Used as the default when the user defers
 * ("not sure where I am") and to bias the first Spark format.
 */
export function fluencyToSkill(fluency: number): SkillLevel {
  if (fluency >= 4) return "architect";
  if (fluency >= 3) return "builder";
  if (fluency >= 1) return "explorer";
  return "starter";
}

/**
 * The two-question fluency probe in display order. Each question maps a
 * picked answer index to a fluency contribution. The probe state is
 * stored as `(answers: number[])`, summed via {@link probeScore}.
 */
export interface FluencyProbeQuestion {
  id: "chatbot" | "code";
  prompt: string;
  options: { label: string; emoji: string; score: number }[];
}

export const FLUENCY_PROBE: FluencyProbeQuestion[] = [
  {
    id: "chatbot",
    prompt: "Have you chatted with ChatGPT, Claude, or Gemini?",
    options: [
      { label: "Not yet", emoji: "🌱", score: 0 },
      { label: "A few times", emoji: "🙂", score: 1 },
      { label: "Regularly", emoji: "⚡", score: 2 },
    ],
  },
  {
    id: "code",
    prompt: "Have you written code or a custom prompt before?",
    options: [
      { label: "Never", emoji: "🌱", score: 0 },
      { label: "A little", emoji: "🛠", score: 1 },
      { label: "I ship code", emoji: "🚀", score: 2 },
    ],
  },
];

/**
 * Sum the per-question scores into a 0..4 fluency. Defensive: ignores
 * out-of-range indexes (treats them as 0) so a stale UI never produces
 * a NaN downstream.
 */
export function probeScore(answers: readonly number[]): number {
  let total = 0;
  for (let i = 0; i < FLUENCY_PROBE.length; i++) {
    const q = FLUENCY_PROBE[i];
    const idx = answers[i];
    const opt = q.options[idx];
    if (opt) total += opt.score;
  }
  return Math.max(0, Math.min(4, total));
}

/**
 * Display strings for the Onboarding "first-Spark preview" + the Home
 * fresh-stage personalized header. Pure formatting, kept here so the
 * copy lives next to the role logic.
 */
export const ROLE_LABEL: Record<Role, { label: string; emoji: string; sub: string }> = {
  student: { label: "Student / Kid", emoji: "🎒", sub: "Curious about AI, no jargon" },
  pm: { label: "Product Manager", emoji: "📐", sub: "Make sharper AI calls" },
  engineer: { label: "Engineer", emoji: "🛠️", sub: "Ship AI features" },
  designer: { label: "Designer", emoji: "🎨", sub: "AI in your craft" },
  creator: { label: "Creator / Educator", emoji: "🎙️", sub: "Use AI in your work" },
  exec: { label: "Exec / Leader", emoji: "🧭", sub: "Steer AI strategy" },
  researcher: { label: "Researcher", emoji: "🔬", sub: "Frontier rigor" },
  curious: { label: "Curious adult", emoji: "🌱", sub: "I just want to keep up" },
  other: { label: "Something else", emoji: "✨", sub: "We'll keep it broad" },
};
