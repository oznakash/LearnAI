export type AgeBand = "kid" | "teen" | "adult";

export type SkillLevel = "starter" | "explorer" | "builder" | "architect" | "visionary";

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
  | "podcastnugget";

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

export interface MicroRead {
  type: "microread";
  title: string;
  body: string;       // 60-120 words
  takeaway: string;   // one sentence
  visual?: VisualKey;
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
}

/**
 * A short, attributed nugget from an external podcast / interview source.
 *
 * - The nugget's `quote` is always ≤ 60 words. Always shown verbatim, in
 *   quotation marks, attributed to the named guest.
 * - The `source.podcastUrl` always points at the podcast root (we do not
 *   deep-link to specific episode pages — see `docs/lenny-archive.md`).
 * - The chip + "Listen" link both open `source.podcastUrl` in a new tab.
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
  | PodcastNugget;

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
  apiKey?: string;     // optional
  apiProvider?: "anthropic" | "openai";
  googleClientId?: string;
  lastCalibrationAt?: number;
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
