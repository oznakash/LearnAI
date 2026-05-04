export type AgeBand = "kid" | "teen" | "adult";

export type SkillLevel = "starter" | "explorer" | "builder" | "architect" | "visionary";

/**
 * The user's intent — the *mode* they're in, not the topic they like.
 *
 * Captured at onboarding (multi-select; users can be in more than one
 * mode). Drives the secondary CTA on the Level-Cleared screen and other
 * personalization decisions: a *Curious* user wanting to understand
 * shouldn't be nudged toward a Build Card, and an *Applied* user
 * shouldn't be nudged toward "go deeper into theory."
 *
 * See `docs/content-model.md` §5 for the full mapping of intent → CTA
 * shape and `docs/first-time-builder-findings.md` for why this fix is
 * load-bearing on WAB.
 */
export type Intent = "curious" | "applied" | "decision" | "researcher" | "forker";

/**
 * The user's *role* — who they are, not what they're trying to do.
 *
 * Captured at onboarding, drives:
 *   - **Topic pre-selection** — a PM gets `ai-pm` + `ai-trends` + … checked
 *     by default; an engineer gets `ai-builder` + `ai-devtools` + …; a kid
 *     gets `ai-foundations` + `ai-news` + simpler-language topics.
 *   - **Skill self-report sanity check** — a 12-year-old is unlikely to be
 *     "Senior architect"; a researcher is unlikely to be "Curious starter".
 *     We don't override the user's pick, just suggest a sensible default.
 *   - **Future tone shaping** — kid-band copy when the role is `student`,
 *     business-tone when `pm` / `exec`, etc.
 *
 * Optional (`role?` on PlayerProfile) so back-compat with profiles created
 * before this field shipped is automatic. Consumers should treat
 * `undefined` as "no role hint; fall back to age-band heuristics."
 */
export type Role =
  | "student"   // kids and teens — simpler language, more games, basic news
  | "pm"        // product managers — better calls, blends trends + skills
  | "engineer"  // software engineers / hobbyists who ship code
  | "designer"  // designers thinking about AI in their craft
  | "creator"   // content creators / educators / writers
  | "exec"      // execs / leaders / decision-makers
  | "researcher"// frontier researchers, paper readers
  | "curious"   // adults who are simply curious about AI
  | "other";    // catch-all so the wizard never blocks

export type TopicId =
  | "ai-foundations"
  | "llms-cognition"
  | "memory-safety"
  | "ai-pm"
  | "ai-builder"
  | "cybersecurity"
  | "cloud"
  | "ai-devtools"
  | "ai-trends"
  | "frontier-companies"
  | "ai-news"
  | "open-source";

export interface Topic {
  id: TopicId;
  name: string;
  emoji: string;
  tagline: string;
  color: string;
  visual?: VisualKey;
  levels: Level[];
}

export interface Level {
  id: string;
  index: number;
  title: string;
  goal: string;
  estMinutes: number;
  sparks: Spark[];
}

export type ExerciseType =
  | "microread"
  | "quickpick"
  | "patternmatch"
  | "fillstack"
  | "scenario"
  | "buildcard"
  | "tip"
  | "boss"
  | "podcastnugget"
  | "youtubenugget";

/**
 * The freshness category of a Spark. Drives the shelf-life model in
 * `docs/content-freshness.md` §2 — `news` ages in 14 days, `pattern`
 * in 6 months, `principle` in 2 years. The renderer uses this to show
 * a freshness chip ("📅 Added <date>" / "🕒 Aging" / "⚠️ Stale") and the
 * sequencer uses it to deprioritize stale Sparks when the admin's
 * `flags.autoSkipStaleContent` is on.
 */
export type SparkCategory =
  | "principle"   // RAG concept · cost-engineering thesis · eval discipline. 2-year shelf.
  | "pattern"     // Router pattern · prompt caching · LLM-as-judge. 6-month shelf.
  | "tooling"     // Cursor / Claude Code / pgvector / Pinecone. 3-month shelf.
  | "company"     // Anthropic strategy · Stripe Press essays. 30-day shelf.
  | "news"        // Today's launch · today's release note · today's blog. 14-day shelf.
  | "frontier";   // arXiv preprints · lab leaks · leadership moves. 7-day shelf.

export type VisualKey =
  | "neural"
  | "data"
  | "embed"
  | "tokens"
  | "shield"
  | "cloud"
  | "rocket"
  | "graph"
  | "robot"
  | "trophy"
  | "spark"
  | "lock"
  | "compass"
  | "stack"
  | "chip"
  | "news"
  | "open"
  | "trend"
  | "build"
  | "key"
  | "memory";

/**
 * A vocabulary atom — a term that appears in a Spark's body, with the
 * inline definition the user sees on tap. The smallest content unit
 * in the corpus (smaller than a Spark itself).
 *
 * Per `docs/content-model.md` §2.4, atoms are how the just-in-time
 * vocabulary loop closes: when a Spark uses a term the user hasn't
 * met, they can tap to learn (popover with the inline `definition`)
 * and optionally fire a `zoom` signal for a deeper Spark later. The
 * cognition layer logs every tap as a `vocabulary`-category memory.
 *
 * Author rules:
 *   - `term` should appear *as-is* somewhere in the spark's `body`
 *     (case-insensitive). The renderer does a word-boundary match.
 *   - `definition` ≤ 30 words; should land without context.
 *   - Don't include synonyms or aliases; pick the canonical surface
 *     form. The renderer doesn't infer plurals or stems.
 */
export interface VocabAtom {
  term: string;
  definition: string;
}

/**
 * Source attribution for hand-authored Sparks (MicroRead, Tip, future
 * EssayNugget / ReleaseNote / NewsletterNugget variants). Renders as
 * a small, quiet cite chip below the body — same shape as the more
 * prominent `🎙️ Lenny's Podcast` chip on `PodcastNugget`.
 *
 * Why this is its own type, not just a string: every source-anchored
 * Spark inherits the same attribution contract — name + URL — so the
 * renderer (and the future vocabulary recommender) can treat them
 * uniformly. See `docs/aha-and-network.md` §2.3 for the trust rationale
 * and `docs/content-model.md` §2.2 for the source-anchored thesis.
 *
 * Schema lands in Sprint #1. Content backfill — citing real sources on
 * the worst-rated 100 Sparks — happens in Sprint #3 alongside the
 * editorial pass.
 */
export interface SparkSource {
  /** Human-readable name shown on the chip — e.g. "Anthropic Blog", "Stripe Press". */
  name: string;
  /** Direct URL to the source. Opens in a new tab. */
  url: string;
}

export interface MicroRead {
  type: "microread";
  title: string;
  body: string;       // 60-120 words
  takeaway: string;   // one sentence
  visual?: VisualKey;
  /**
   * Optional vocabulary atoms used in the body. The renderer wraps
   * each occurrence as a tappable underline; tapping reveals the
   * inline definition + an optional "Zoom in" affordance. Optional —
   * Sparks without `vocab` render exactly as today.
   */
  vocab?: VocabAtom[];
  /** Optional source attribution. See {@link SparkSource}. */
  source?: SparkSource;
  /**
   * Optional freshness category. See {@link SparkCategory} +
   * `docs/content-freshness.md` §2. When set, the renderer surfaces a
   * `📅 Added` / `🕒 Aging` / `⚠️ Stale` chip; the sequencer can
   * deprioritize stale content. Required for time-sensitive sparks
   * (`tooling`, `company`, `news`, `frontier`).
   */
  category?: SparkCategory;
  /**
   * ISO date the Spark was authored or last reviewed. Used with
   * `category` to compute the freshness chip. A `category` without
   * `addedAt` shows the category badge but no aging signal.
   */
  addedAt?: string;
  /**
   * Optional age-band-specific body text. The renderer picks
   * `bodyByAgeBand[profile.ageBand]` first; falls back to `body`. Use
   * for Sparks whose adult voice is off-key for kids — see
   * `docs/content-freshness.md` §4 for the kid-voice rules.
   */
  bodyByAgeBand?: { kid?: string; teen?: string; adult?: string };
}

export interface QuickPick {
  type: "quickpick";
  prompt: string;
  options: string[];
  answer: number; // index
  explain: string;
}

export interface PatternMatch {
  type: "patternmatch";
  prompt: string;
  pairs: { left: string; right: string }[];
  explain: string;
}

export interface FillStack {
  type: "fillstack";
  prompt: string;       // sentence with "___" blank
  options: string[];
  answer: number;
  explain: string;
}

export interface Scenario {
  type: "scenario";
  setup: string;        // 2-3 sentences setting the stage
  prompt: string;       // "what would you do?"
  options: string[];
  answer: number;
  explain: string;
}

export interface BuildCard {
  type: "buildcard";
  title: string;
  pitch: string;        // why try it (2 lines)
  promptToCopy: string; // exact prompt to paste into Claude Code
  successCriteria: string;
}

export interface Boss {
  type: "boss";
  title: string;
  questions: QuickPick[];
}

export interface Tip {
  type: "tip";
  title: string;       // e.g. "Tip & Trick"
  body: string;        // 30-60 words
  bonusXP?: number;    // small XP bump for reading
  visual?: VisualKey;
  /** See {@link VocabAtom}. Optional. */
  vocab?: VocabAtom[];
  /** Optional source attribution. See {@link SparkSource}. */
  source?: SparkSource;
  /** See {@link SparkCategory} + `docs/content-freshness.md` §2. */
  category?: SparkCategory;
  /** ISO date — see {@link MicroRead.addedAt}. */
  addedAt?: string;
  /** See {@link MicroRead.bodyByAgeBand} + `docs/content-freshness.md` §4. */
  bodyByAgeBand?: { kid?: string; teen?: string; adult?: string };
}

/**
 * A short, attributed nugget extracted from a YouTube video. Same
 * compression rubric and curation discipline as `PodcastNugget` (see
 * `docs/lenny-archive.md` §4); different source. Pilot constraints (per
 * `docs/content-freshness.md` §7):
 *   - source video duration ≥ 5 minutes
 *   - source video published within the last 2 months at curation time
 *   - quote ≤ 60 words
 *   - card opens the original video in a new tab on click
 *
 * Render shape parallel to `PodcastNugget` — chip → guest line →
 * blockquote → takeaway → optional CTA → "Watch on YouTube →" link. The
 * chip is YouTube-red-tinted to set it apart visually.
 */
export interface YoutubeNugget {
  type: "youtubenugget";
  /** ≤ 60 words. Direct quote or close paraphrase from the video. */
  quote: string;
  /** One sentence. The takeaway the user walks away with. */
  takeaway: string;
  /** Source attribution — never empty. */
  source: {
    platform: "youtube";
    /** Direct YouTube URL. Opens in a new tab. */
    videoUrl: string;
    videoTitle: string;
    /** The channel that published the video. */
    channelName: string;
    /** ISO date the video was published. Must be ≤ 60 days old at curation. */
    publishedAt: string;
    /** Video duration in minutes. Must be ≥ 5 at curation. */
    durationMinutes: number;
    /** Approximate timestamp inside the video for the quote (mm:ss). */
    timestamp?: string;
  };
  /** Optional follow-up the user can do — keeps Build-Don't-Just-Read alive. */
  ctaPrompt?: string;
  /** See {@link SparkCategory}. Most YouTube nuggets are `news` or `tooling`. */
  category?: SparkCategory;
  /** ISO date this Spark was authored / last reviewed. */
  addedAt?: string;
  visual?: VisualKey;
}

/**
 * A creator is an external content source (podcast / newsletter / channel
 * / blog) that LearnAI credits inside Sparks. Creators live in a registry
 * (seed defaults + admin overrides) so adding a new creator is a config
 * change, not a code change. Sparks reference creators by `creatorId`.
 *
 * The registry is the source of truth for *who is being credited and
 * how* (display name, avatar, credit URL, link label). Per-Spark fields
 * like guest / episode title still live on the Spark itself — they vary
 * per nugget; the creator never does.
 *
 * Adding a creator from Admin → Creators surfaces them as a category in
 * the content admin and unlocks per-creator filters / counts. Deleting a
 * creator is blocked while any Spark still references it.
 */
export type CreatorKind =
  | "podcast"
  | "newsletter"
  | "channel"
  | "blog"
  | "book"
  | "other";

export type CreatorId = string;

export interface Creator {
  id: CreatorId;
  name: string;
  /** Optional handle (e.g. "@lennysan") shown as a secondary line. */
  handle?: string;
  kind: CreatorKind;
  /** Hosted image URL for the avatar. Falls back to `avatarEmoji`. */
  avatarUrl?: string;
  /** 1–3 char emoji fallback when no `avatarUrl` is set. */
  avatarEmoji?: string;
  /** Optional hex accent for the credit chip; defaults to the warn token. */
  accentColor?: string;
  /** Where the credit chip + "Listen / Read" link lands. */
  creditUrl: string;
  /** Label for the link (e.g. "Listen on Lenny's Podcast"). */
  creditLabel: string;
  /** Optional one-paragraph blurb shown on the creator's admin card. */
  bio?: string;
}

/**
 * A short, attributed nugget from an external podcast / interview source.
 *
 * - The nugget's `quote` is always ≤ 60 words. Always shown verbatim, in
 *   quotation marks, attributed to the named guest.
 * - The credit chip + "Listen" link open the creator's `creditUrl` (looked
 *   up from the registry by `creatorId`) — we do not deep-link to specific
 *   episode pages. See `docs/lenny-archive.md`.
 * - For back-compat with seeds authored before the creator registry, the
 *   inline `source.podcastUrl` is used as a fallback when no `creatorId`
 *   resolves to a known creator.
 *
 * Render passively (like MicroRead / Tip) — read, takeaway, "Got it ⚡".
 * If `flags.lennyContentEnabled` is OFF, the topic loader strips every
 * PodcastNugget Spark before topics reach the player UI.
 */
export interface PodcastNugget {
  type: "podcastnugget";
  /** ≤ 60 words. Direct quote or close paraphrase. Wrapped in “…” at render. */
  quote: string;
  /** One sentence. The takeaway the user walks away with. */
  takeaway: string;
  /**
   * Creator registry id. New nuggets should set this so credit (name,
   * URL, avatar, label) is sourced from Admin → Creators. Optional only
   * for back-compat with seeds authored before the registry shipped.
   */
  creatorId?: CreatorId;
  /** Source attribution — never empty. */
  source: {
    /** Display name of the podcast, e.g. "Lenny's Podcast". */
    podcast: string;
    /** Always the podcast root URL — we do NOT deep-link to episodes. */
    podcastUrl: string;
    /** Guest as printed on the episode page. */
    guest: string;
    /** Guest's role / company at recording time. Optional but recommended. */
    guestRole?: string;
    /** Episode title (for the credit line — not used as a link). */
    episodeTitle?: string;
    /** Approximate timestamp inside the source, kept for our verification. */
    timestamp?: string;
  };
  /** Optional follow-up the user can do — keeps Build-Don't-Just-Read alive. */
  ctaPrompt?: string;
  /** Optional XP override for this specific nugget (defaults to tip-tier XP). */
  bonusXP?: number;
  visual?: VisualKey;
}

export type Exercise =
  | MicroRead
  | QuickPick
  | PatternMatch
  | FillStack
  | Scenario
  | BuildCard
  | Tip
  | Boss
  | PodcastNugget
  | YoutubeNugget;

export interface Spark {
  id: string;
  title: string;
  exercise: Exercise;
}

export type GuildTier = "Builder" | "Architect" | "Visionary" | "Founder" | "Singularity";

export interface PlayerProfile {
  name: string;
  ageBand: AgeBand;
  age?: number;
  skillLevel: SkillLevel;
  interests: TopicId[];
  dailyMinutes: number;
  goal: string;            // free text or preset
  experience: string;      // free text
  /**
   * Multi-select user intent captured at onboarding. Optional for
   * back-compat with profiles created before the intent UX shipped —
   * downstream consumers should treat `undefined` and `[]` the same
   * (no intent set; default to the universal CTA).
   */
  intents?: Intent[];
  /**
   * The user's professional / life role, captured at onboarding. Drives
   * topic pre-selection, skill defaults, and (in the future) copy tone.
   * Optional for back-compat — older profiles fall back to the existing
   * age-band heuristics. See {@link Role}.
   */
  role?: Role;
  /**
   * AI-fluency score (0..4) inferred from the onboarding probe. Captures
   * "have you used ChatGPT/Claude?" + "have you written code or a prompt
   * before?" as a 0..4 scalar. Used to map to a sensible starting skill
   * when the user defers ("not sure where I am") and to bias the first
   * Spark format (low fluency → MicroRead, high fluency → BuildCard).
   * Optional for back-compat.
   */
  fluency?: number;
  /**
   * Numeric level (1-10) inferred by the most recent calibration. Maps
   * to the same 1..N index used by Topic levels — when a player opens a
   * topic they haven't started yet, the engine recommends the level
   * matching this number rather than always starting at L1. Optional
   * for back-compat with profiles created before adaptive calibration
   * shipped; absence means "fall back to linear progression from L1."
   *
   * Set by the calibration view via `scoreCalibration()`. Independent
   * from per-topic completion: once a player makes progress in a topic,
   * the engine resumes from their actual progress rather than this
   * starting offset.
   */
  calibratedLevel?: number;
  createdAt: number;
}

export interface ProgressState {
  // per-topic per-level: completed sparks
  completed: Record<string, string[]>; // levelId -> sparkIds
  bossPassed: Record<string, boolean>; // levelId
  topicXP: Record<string, number>;
  topicLastTouched: Record<string, number>;
}

export interface SessionRecord {
  ts: number;
  topicId: TopicId;
  levelId: string;
  sparkIds: string[];
  correct: number;
  total: number;
  minutes: number;
}

export type SparkVote = "up" | "down";

/**
 * A single user feedback record on a Spark. Stored per-player; written once
 * (idempotent on repeat votes of the same value, overwritten on a flip).
 *
 * `vote: "down"` is the **permanent skip** signal — the spark is never
 * shown to that user again on that device. The cognition layer also
 * receives a `preference` memory write so it stops surfacing similar
 * shapes (see `views/Play.tsx`).
 */
export interface SparkFeedback {
  sparkId: string;
  vote: SparkVote;
  /** Optional one-line "why" the user added on a 👎 vote. Free text. */
  reason?: string;
  topicId?: TopicId;
  levelId?: string;
  /** Last-vote timestamp (ms since epoch). Updated on every vote/flip. */
  ts: number;
}

/**
 * Two state-of-mind signals the user can fire on any Spark. **Distinct
 * from `SparkVote`**, which is a quality rating about the Spark itself.
 * Signals carry information about the user's *moment* — not about the
 * Spark's quality.
 *
 * - `zoom`: "I want to go deeper on this." Captures intent for the
 *   cognition layer to surface deeper Sparks later. Optionally carries
 *   a free-text reason ("what specifically did you want more on?") —
 *   high-quality signal for future content authoring.
 * - `skip-not-now`: "Not relevant in this moment, but don't filter
 *   forever." Soft-skip — distinct from `SparkVote: "down"` (permanent).
 *   The current session moves on; the Spark may resurface later.
 *
 * See `docs/content-model.md` §2.3 for the full contract.
 */
export type SparkSignal = "zoom" | "skip-not-now";

export interface SparkSignalRecord {
  sparkId: string;
  signal: SparkSignal;
  /** Optional free-text — most useful on `zoom` ("what did you want more on?"). */
  reason?: string;
  topicId?: TopicId;
  levelId?: string;
  ts: number;
}

export type TaskKind = "watch" | "read" | "build" | "explore" | "custom";
export type TaskStatus = "todo" | "doing" | "done";

export interface Task {
  id: string;
  kind: TaskKind;
  title: string;
  notes?: string;
  url?: string;             // YouTube, article, etc.
  promptToCopy?: string;    // for build tasks (Claude Code prompt)
  source?: {
    topicId?: TopicId;
    levelId?: string;
    sparkId?: string;
  };
  status: TaskStatus;
  createdAt: number;
  updatedAt: number;
  dueAt?: number;
}

export interface ServerSessionState {
  /** JWT signed by mem0 with JWT_SECRET. Sent as Bearer for all mem0 calls. */
  token: string;
  email: string;
  name?: string;
  picture?: string;
  isAdmin: boolean;
  /** Unix seconds. */
  expiresAt: number;
}

export interface PlayerState {
  profile: PlayerProfile | null;
  identity?: {
    email: string;
    name?: string;
    picture?: string;
    sub?: string;
    provider: "google";
  };
  /**
   * Present iff the SPA is in production server-auth mode and the user has
   * a current (non-expired) session JWT from mem0. Cleared on signout, on
   * hydrate when expired, or when mode flips back to demo.
   */
  serverSession?: ServerSessionState;
  xp: number;
  focus: number;       // 0..5 hearts
  focusUpdatedAt: number;
  streak: number;
  streakUpdatedAt: number;
  badges: string[];
  guildTier: GuildTier;
  progress: ProgressState;
  history: SessionRecord[];
  tasks: Task[];
  /**
   * Per-Spark thumbs-up / thumbs-down feedback. 👎 sparks are
   * permanently skipped for this user via the topic loader and the
   * recommended-spark helpers. The cognition layer receives a
   * `preference` memory write on every 👎.
   */
  feedback?: SparkFeedback[];
  /**
   * State-of-mind signals — "I want to go deeper on this" / "not now".
   * Stored per-player; consumed by the cognition layer to bias future
   * recommendations. Multiple signals per Spark are allowed (e.g. a
   * user can zoom in on different sessions, leaving multiple records).
   * See {@link SparkSignal}.
   */
  signals?: SparkSignalRecord[];
  apiKey?: string;     // optional
  apiProvider?: "anthropic" | "openai";
  googleClientId?: string;
  lastCalibrationAt?: number;
  /**
   * Calibration question ids the player has already seen. The smart
   * selector excludes these from new calibration sessions so the player
   * gets fresh probes every time. Capped at 200 entries — old ids fall
   * off the front when the cap is exceeded. Optional for back-compat.
   */
  seenCalibrationQuestionIds?: string[];
  prefs: {
    sound: boolean;
    haptics: boolean;
    dailyReminderHour?: number;
  };
  /**
   * When true, this player has opted out of the cognition layer.
   * Honoured iff the admin's `flags.memoryPlayerOptIn` is also true —
   * otherwise the cognition layer is on regardless of this field.
   * Synced cross-device via /v1/state.
   */
  memoryOptOut?: boolean;
}

export interface Badge {
  id: string;
  name: string;
  emoji: string;
  description: string;
  rule: (s: PlayerState) => boolean;
}
