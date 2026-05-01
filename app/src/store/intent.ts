/**
 * Intent → Level-Cleared secondary CTA mapping.
 *
 * Today the secondary CTA on every Level-Cleared screen is the
 * universal "↔ Try {switchTopic}". For users who told us *which mode
 * they're in* at onboarding, we should pick a more aligned next step:
 *
 *   - Applied  →  "🛠 Try a Build Card next"   (switch to ai-builder)
 *   - Decision →  "🧪 Try a Scenario from PM"  (switch to ai-pm)
 *   - Curious  →  "📖 Explore the Foundations" (switch to ai-foundations)
 *   - Researcher → "📰 Today in AI News"       (switch to ai-news)
 *   - Forker   →  "🌐 See the fork recipe →"   (external doc link)
 *
 * Priority when the user has multiple intents: applied > decision >
 * curious > researcher > forker. Applied wins because it's the
 * strongest WAB-conversion signal (Build Card path).
 *
 * Returns `null` when no intent applies or the intent's preferred
 * topic is already the user's current topic — the caller falls back
 * to its existing default secondary CTA in that case.
 */

import type { Intent, TopicId } from "../types";

export const INTENT_PRIORITY: readonly Intent[] = [
  "applied",
  "decision",
  "curious",
  "researcher",
  "forker",
];

const INTENT_TO_TOPIC: Record<Intent, TopicId | null> = {
  applied: "ai-builder",
  decision: "ai-pm",
  curious: "ai-foundations",
  researcher: "ai-news",
  forker: null, // external link, not a topic switch
};

const INTENT_LABEL: Record<Intent, { emoji: string; label: string }> = {
  applied: { emoji: "🛠", label: "Try a Build Card next" },
  decision: { emoji: "🧪", label: "Try a Scenario from PM" },
  curious: { emoji: "📖", label: "Explore the Foundations" },
  researcher: { emoji: "📰", label: "Today in AI News" },
  forker: { emoji: "🌐", label: "See the fork recipe →" },
};

const FORK_RECIPE_URL = "https://github.com/oznakash/learnai/blob/main/docs/fork-recipe.md";

export interface IntentCTA {
  intent: Intent;
  label: string;
  /** When set, navigate to this topic; otherwise consult `externalUrl`. */
  topicId: TopicId | null;
  /** When set, open in a new tab. */
  externalUrl: string | null;
}

/**
 * Pick the best Level-Cleared secondary CTA for this user, given their
 * intents and the current topic. Pure — no DOM, no globals — so it's
 * trivially testable and reusable for the recommender later.
 */
export function pickIntentCTA(
  intents: readonly Intent[] | undefined,
  currentTopicId: TopicId
): IntentCTA | null {
  if (!intents || intents.length === 0) return null;

  for (const candidate of INTENT_PRIORITY) {
    if (!intents.includes(candidate)) continue;

    const target = INTENT_TO_TOPIC[candidate];
    if (candidate === "forker") {
      return {
        intent: candidate,
        label: `${INTENT_LABEL.forker.emoji} ${INTENT_LABEL.forker.label}`,
        topicId: null,
        externalUrl: FORK_RECIPE_URL,
      };
    }

    // Skip an intent whose preferred topic is already where the user
    // just was — sending them back where they came from is the
    // opposite of an aligned nudge. Try the next priority candidate.
    if (target === currentTopicId) continue;

    return {
      intent: candidate,
      label: `${INTENT_LABEL[candidate].emoji} ${INTENT_LABEL[candidate].label}`,
      topicId: target,
      externalUrl: null,
    };
  }

  return null;
}
