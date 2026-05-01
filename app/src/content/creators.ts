import type { Creator, CreatorId } from "../types";

/**
 * Seed creator registry. The admin tab (Admin → Creators) merges this
 * with `AdminConfig.creators` overrides at runtime — operators add new
 * creators or edit these defaults without touching code.
 *
 * Each creator is the *source* a Spark credits. The registry holds the
 * stable bits (display name, link, avatar, credit label); per-Spark
 * fields like quote / guest / episode stay on the Spark.
 *
 * Adding a creator here:
 *   1. Pick a stable, kebab-case `id` (used as a foreign key by Sparks).
 *   2. Set `creditUrl` to the home/root URL for the source. We do NOT
 *      deep-link to specific episodes / posts — the link should always
 *      send the user to the creator's house.
 *   3. Pick an `avatarEmoji` if no hosted image is available; the player
 *      UI prefers `avatarUrl` when set.
 */
export const SEED_CREATORS: Record<CreatorId, Creator> = {
  lenny: {
    id: "lenny",
    name: "Lenny's Podcast",
    handle: "@lennysan",
    kind: "podcast",
    avatarEmoji: "🎙️",
    creditUrl: "https://www.lennysnewsletter.com/podcast",
    creditLabel: "Listen on Lenny's Podcast",
    bio: "Conversations with the world's top product, growth, and AI builders. Hosted by Lenny Rachitsky.",
  },
};

export const SEED_CREATOR_LIST: Creator[] = Object.values(SEED_CREATORS);
