import type { CreatorId } from "../types";

/**
 * Content-feed registry — the daily steward and the admin paste-and-draft
 * UI use this to know **where to fetch fresh content for each creator**
 * instead of HTML-scraping their homepage.
 *
 * The win: WebFetch chokes on JS-rendered pages (AlphaSignal returns 403,
 * YouTube channel pages are client-rendered, HN homepage is heavy with
 * client-side JS). But every one of those sources publishes a clean,
 * stable feed (RSS / Atom / JSON API) that WebFetch can read in one shot.
 *
 * The steward's contract:
 *   - For each creator with an entry here, fetch the feed URL via WebFetch
 *   - Parse the latest N entries (title + link + pubDate)
 *   - For each entry: filter to ≤ <freshDays> old, distill to a Spark,
 *     attribute via the creator's id + name + creditUrl from creators.ts
 *   - Drop entries that fail any of: pubDate parse, title empty, link
 *     missing, or pubDate older than freshDays.
 *
 * **Server-side fetcher with headless-browser fallback** is the next
 * sprint's deeper lift (see `docs/roadmap.md`). For now this registry is
 * how we sidestep the JS-rendered-page problem entirely.
 */
export interface ContentFeed {
  /** Foreign key into `SEED_CREATORS`. */
  creatorId: CreatorId;
  /** WebFetch-friendly URL — verified to return content directly, no JS. */
  url: string;
  /** Helps the steward pick the right parser. */
  format: "atom" | "rss" | "json";
  /**
   * Freshness window the steward should respect. Sources with daily
   * cadence (HN, AlphaSignal) → 7d; weekly newsletters → 14d; lab blogs
   * → 30d; arXiv → 14d (it firehoses).
   */
  freshDays: number;
  /**
   * Optional human note for the steward — what to look for when triaging
   * the feed. The steward folds this into its content-distillation prompt.
   */
  triageHint?: string;
}

export const CONTENT_FEEDS: ContentFeed[] = [
  // Atom feed — Simon's TIL-style posts. Direct, dated, ready to distill.
  {
    creatorId: "simonwillison",
    url: "https://simonwillison.net/atom/everything/",
    format: "atom",
    freshDays: 14,
    triageHint:
      "Pick posts about LLM tooling, prompt-injection defenses, or new model behaviors. Skip personal / non-AI posts.",
  },
  // RSS — Hugging Face blog. Heavy on releases, datasets, fine-tuning writeups.
  {
    creatorId: "huggingface-blog",
    url: "https://huggingface.co/blog/feed.xml",
    format: "rss",
    freshDays: 30,
    triageHint:
      "Open-model releases, dataset drops, and concrete training/serving writeups. Skip pure marketing.",
  },
  // Algolia HN search API — front-page AI stories with a points floor.
  // JSON, no auth, no rate-limit issues for low-volume polling.
  {
    creatorId: "hacker-news-ai",
    url: "https://hn.algolia.com/api/v1/search_by_date?tags=story&query=AI&numericFilters=points%3E100&hitsPerPage=10",
    format: "json",
    freshDays: 7,
    triageHint:
      "Hits with > 100 points are usually substantive. Read the link + top comment for the actual lesson, not the headline.",
  },
  // YouTube channel feeds — channel_id can be found by visiting the
  // channel page and scraping the `channelId` from the HTML <meta>. These
  // are pre-resolved by id for stable polling.
  {
    creatorId: "3blue1brown",
    url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCYO_jab_esuFRV4b17AJtAw",
    format: "atom",
    freshDays: 90,
    triageHint:
      "Grant ships rarely; every video is gold. Lift the highest-density 60-90s explanation as a YouTubeNugget.",
  },
  {
    creatorId: "karpathy",
    url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCPk3RMMXAfLhMJPFpQhye9g",
    format: "atom",
    freshDays: 180,
    triageHint:
      "Karpathy publishes deep lectures — pick the moment in the video where he names a concrete pattern (e.g., 'attention is broadcast', 'the spelled-out version').",
  },
  {
    creatorId: "two-minute-papers",
    url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCbfYPyITQ-7l4upoX8nvctg",
    format: "atom",
    freshDays: 30,
    triageHint:
      "Pick papers that demonstrate a real capability shift (not just incremental). Filter out hype framings.",
  },
  {
    creatorId: "ai-explained",
    url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCNJ1Ymd5yFuUPtn21xtRbbw",
    format: "atom",
    freshDays: 14,
    triageHint:
      "Philip is measured + paper-grounded. Pull benchmark surprises and the 'what changed since last week' through-line.",
  },
  // arXiv — RSS-like Atom feed for the cs.AI category. Firehose; the
  // steward should triage hard (90% of papers don't survive abstract).
  {
    creatorId: "arxiv-cs-ai",
    url: "http://export.arxiv.org/api/query?search_query=cat:cs.AI&max_results=10&sortBy=submittedDate&sortOrder=descending",
    format: "atom",
    freshDays: 14,
    triageHint:
      "Triage by abstract first. Skip math-heavy theory unless the result is a capability claim. Prefer papers with public code/weights links.",
  },
  // Latent Space substack — RSS feed.
  {
    creatorId: "latent-space",
    url: "https://www.latent.space/feed",
    format: "rss",
    freshDays: 30,
    triageHint:
      "Long-form takes; pull the mid-essay 'why this matters to a builder' moment, not the intro framing.",
  },
];

export const FEEDS_BY_CREATOR: Record<CreatorId, ContentFeed | undefined> =
  Object.fromEntries(CONTENT_FEEDS.map((f) => [f.creatorId, f])) as Record<
    CreatorId,
    ContentFeed | undefined
  >;
