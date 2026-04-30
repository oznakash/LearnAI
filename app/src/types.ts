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
  | "boss";

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

export type Exercise =
  | MicroRead
  | QuickPick
  | PatternMatch
  | FillStack
  | Scenario
  | BuildCard
  | Tip
  | Boss;

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
  apiKey?: string;     // optional
  apiProvider?: "anthropic" | "openai";
  googleClientId?: string;
  lastCalibrationAt?: number;
  prefs: {
    sound: boolean;
    haptics: boolean;
    dailyReminderHour?: number;
  };
}

export interface Badge {
  id: string;
  name: string;
  emoji: string;
  description: string;
  rule: (s: PlayerState) => boolean;
}
