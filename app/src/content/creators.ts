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

  // ─── Sprint #2 — External content sources ──────────────────────────
  // Operator directive: pull fresh AI knowledge from sources where
  // content is < 2 weeks old. Each source becomes a Creator; nuggets
  // surface inside Sparks via the existing source-anchor render.
  // See `docs/content-freshness.md` §6 for the curation rubric.

  alphasignal: {
    id: "alphasignal",
    name: "AlphaSignal",
    kind: "newsletter",
    avatarEmoji: "📬",
    accentColor: "#0E0F12",
    creditUrl: "https://alphasignal.ai/archive",
    creditLabel: "Read on AlphaSignal",
    bio: "Daily AI digest. Pre-curated, headline-shaped, freshness measured in days.",
  },
  "hacker-news-ai": {
    id: "hacker-news-ai",
    name: "Hacker News",
    kind: "other",
    avatarEmoji: "🔶",
    accentColor: "#FF6600",
    creditUrl: "https://news.ycombinator.com",
    creditLabel: "Read on Hacker News",
    bio: "Front-page AI stories from the builder community. Highest-velocity signal of what builders care about today.",
  },
  "yc-blog": {
    id: "yc-blog",
    name: "Y Combinator",
    kind: "blog",
    avatarEmoji: "🟧",
    accentColor: "#F26625",
    creditUrl: "https://www.ycombinator.com/blog",
    creditLabel: "Read on Y Combinator",
    bio: "Founder-grade essays + portfolio launches. High earned-insight density.",
  },
  "anthropic-news": {
    id: "anthropic-news",
    name: "Anthropic",
    kind: "blog",
    avatarEmoji: "🟫",
    accentColor: "#CC785C",
    creditUrl: "https://www.anthropic.com/news",
    creditLabel: "Read on Anthropic",
    bio: "Frontier-lab announcements: Claude releases, system cards, safety research.",
  },
  simonwillison: {
    id: "simonwillison",
    name: "Simon Willison",
    handle: "@simonw",
    kind: "blog",
    avatarEmoji: "🧪",
    accentColor: "#1D6FB7",
    creditUrl: "https://simonwillison.net",
    creditLabel: "Read on simonwillison.net",
    bio: "TIL-style posts on AI engineering — ultra-fresh, ultra-concrete, already Spark-shaped. Coined 'prompt injection'.",
  },
  "huggingface-blog": {
    id: "huggingface-blog",
    name: "Hugging Face",
    kind: "blog",
    avatarEmoji: "🤗",
    accentColor: "#FFD21E",
    creditUrl: "https://huggingface.co/blog",
    creditLabel: "Read on Hugging Face",
    bio: "New models, datasets, training writeups — open ecosystem of record.",
  },
  "latent-space": {
    id: "latent-space",
    name: "Latent Space",
    handle: "@latentspacepod",
    kind: "newsletter",
    avatarEmoji: "🛰️",
    accentColor: "#000000",
    creditUrl: "https://www.latent.space",
    creditLabel: "Read on Latent Space",
    bio: "Deep takes on AI engineering and frontier shipping. Swyx + Alessio.",
  },
  "deepmind-blog": {
    id: "deepmind-blog",
    name: "Google DeepMind",
    kind: "blog",
    avatarEmoji: "🌐",
    accentColor: "#4285F4",
    creditUrl: "https://deepmind.google/discover/blog/",
    creditLabel: "Read on Google DeepMind",
    bio: "Research drops: Gemini, AlphaFold-line work, frontier benchmarks.",
  },
  "3blue1brown": {
    id: "3blue1brown",
    name: "3Blue1Brown",
    handle: "@3blue1brown",
    kind: "channel",
    avatarEmoji: "🎬",
    accentColor: "#3B82F6",
    creditUrl: "https://www.youtube.com/@3blue1brown",
    creditLabel: "Watch on 3Blue1Brown",
    bio: "Grant Sanderson's geometric intuition for math. Attention, neural-net visualizations — the canonical 'I get it' moment.",
  },
  karpathy: {
    id: "karpathy",
    name: "Andrej Karpathy",
    handle: "@karpathy",
    kind: "channel",
    avatarEmoji: "🧠",
    accentColor: "#FF7A00",
    creditUrl: "https://www.youtube.com/@AndrejKarpathy",
    creditLabel: "Watch on Karpathy",
    bio: "From-scratch LLM lectures + Software 1.0/2.0/3.0 thinking. Highest density teaching on the planet.",
  },
  "two-minute-papers": {
    id: "two-minute-papers",
    name: "Two Minute Papers",
    handle: "@twominutepapers",
    kind: "channel",
    avatarEmoji: "📄",
    accentColor: "#7C3AED",
    creditUrl: "https://www.youtube.com/@TwoMinutePapers",
    creditLabel: "Watch on Two Minute Papers",
    bio: "Károly Zsolnai-Fehér's whirlwind tour of new AI papers. 'What a time to be alive!'",
  },
  "ai-explained": {
    id: "ai-explained",
    name: "AI Explained",
    handle: "@aiexplained-official",
    kind: "channel",
    avatarEmoji: "🛰️",
    accentColor: "#1E40AF",
    creditUrl: "https://www.youtube.com/@aiexplained-official",
    creditLabel: "Watch on AI Explained",
    bio: "Philip's measured, paper-grounded takes on frontier launches. No hype, no doom — just signal.",
  },
  "arxiv-cs-ai": {
    id: "arxiv-cs-ai",
    name: "arXiv (cs.AI)",
    kind: "other",
    avatarEmoji: "🧾",
    accentColor: "#B31B1B",
    creditUrl: "https://arxiv.org/list/cs.AI/recent",
    creditLabel: "Read on arXiv",
    bio: "The unfiltered firehose of new AI papers. Triage with care — most don't survive the abstract test.",
  },
};

export const SEED_CREATOR_LIST: Creator[] = Object.values(SEED_CREATORS);
