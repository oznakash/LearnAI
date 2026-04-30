import type { GuildTier, Topic, TopicId } from "../types";

export type EmailTemplateId =
  | "welcome"
  | "first-spark"
  | "daily-reminder"
  | "streak-save"
  | "weekly-digest"
  | "re-engagement"
  | "level-up"
  | "boss-beaten";

export interface EmailTemplate {
  id: EmailTemplateId;
  name: string;        // human label
  description: string; // when it sends
  enabled: boolean;
  subject: string;     // supports {{placeholders}}
  body: string;        // HTML, supports {{placeholders}}
  trigger: string;     // descriptive trigger ("on signup", "after 7d inactive", …)
}

export type EmailProvider =
  | "none"
  | "resend"
  | "smtp-relay"   // POSTs to your own backend / n8n / Make / etc. that speaks SMTP
  | "emailjs"      // EmailJS (purpose-built for browser → SMTP)
  | "postmark"
  | "sendgrid"
  | "ses";         // ses + smtp left for future server-side

export interface EmailConfig {
  provider: EmailProvider;
  apiKey?: string;       // for resend / postmark / sendgrid
  smtp?: {
    host: string;
    port: number;
    secure: boolean;
    username: string;
    password: string;
  };
  /** For "smtp-relay": URL of the POST endpoint that speaks SMTP. */
  webhookUrl?: string;
  /** Optional shared secret sent as `Authorization: Bearer …` to the webhook. */
  webhookAuth?: string;
  /** For "emailjs": service id, template id, public user id. */
  emailjs?: {
    serviceId: string;
    templateId: string;
    userId: string;
  };
  fromName: string;
  fromEmail: string;
  replyTo?: string;
}

export interface FeatureFlags {
  allowDemoMode: boolean;
  allowPlayerApiKeys: boolean;
  publicLeaderboard: boolean;
  liveModeForApiKeyHolders: boolean;
  voiceMode: boolean;
  buildCardVerification: boolean;
  /**
   * Master switch for the cognition / memory layer. When true, BuilderQuest
   * runs entirely on the device with no remote brain (the v1 behaviour). When
   * false, MemoryService talks to the configured mem0 server.
   */
  offlineMode: boolean;
  /** When true, individual players can override the global flag in Settings. */
  memoryPlayerOptIn: boolean;
}

export interface MemoryConfig {
  /** Base URL of the self-hosted mem0 server (e.g. https://mem0.example.com). */
  serverUrl: string;
  /** Bearer token for the mem0 server. */
  apiKey?: string;
  /** Cap on memory writes per user per day. 0 = unlimited. */
  perUserDailyCap: number;
  /** Optional retention in days. Empty/undefined = keep forever. */
  retentionDays?: number;
}

export interface Branding {
  appName: string;
  tagline: string;
  accentColor: string;     // hex
  accent2Color: string;    // hex
  logoEmoji: string;       // for the BQ tile
}

export interface GameTuning {
  /** XP awards by exercise + outcome. */
  xp: {
    microread: number;
    tip: number;
    quickpickCorrect: number;
    quickpickWrong: number;
    fillstackCorrect: number;
    fillstackWrong: number;
    scenarioCorrect: number;
    scenarioWrong: number;
    patternmatchCorrect: number;
    patternmatchWrong: number;
    buildcard: number;
    bossPass: number;
    bossFail: number;
  };
  /** Focus / hearts. */
  focus: {
    max: number;
    regenMinutes: number;
  };
  /** Guild Tier XP thresholds. */
  tiers: {
    architect: number;
    visionary: number;
    founder: number;
    singularity: number;
  };
  /** Boss Cell pass threshold (0..1). */
  bossPassRatio: number;
}

export interface ContentOverrides {
  /** Topic-id ↦ override. Each entry replaces the seeded topic in full. */
  topics: Partial<Record<TopicId, Topic>>;
  /** Extra topics added by the admin (id collisions overwrite seeds). */
  extras: Topic[];
}

export interface PromptStudioState {
  audience: string;     // who is this for?
  topicName: string;
  topicTagline: string;
  level: number;        // 1..10
  count: number;        // # of sparks per call
  customNote?: string;
}

export interface AdminConfig {
  bootstrapped: boolean;
  admins: string[];               // gmail addresses
  branding: Branding;
  flags: FeatureFlags;
  defaultDailyMinutes: number;
  emailConfig: EmailConfig;
  emailTemplates: Record<EmailTemplateId, EmailTemplate>;
  perUserDailyTokenCap: number;   // 0 = unlimited
  emailQueue: QueuedEmail[];
  tuning: GameTuning;
  contentOverrides: ContentOverrides;
  promptStudio: PromptStudioState;
  memoryConfig: MemoryConfig;
  /**
   * Google OAuth Client ID for Gmail sign-in. A deployment-level value set
   * once by the operator via Admin → Config. Without it (and without
   * AUTH_DISABLED-style demo mode), sign-in is not possible. Stored in the
   * admin localStorage namespace, not per-player, because the same Client
   * ID applies to every visitor of a given deployment.
   */
  googleClientId?: string;
}

export interface QueuedEmail {
  id: string;
  to: string;
  templateId: EmailTemplateId;
  subjectRendered: string;
  bodyRendered: string;
  queuedAt: number;
  status: "queued" | "sent" | "failed";
  error?: string;
}

/**
 * MockUser is the shape used for the Users tab when there is no backend.
 * Real production data will share the same shape (with extra server-only
 * fields) so this UI keeps working.
 */
export interface MockUser {
  id: string;
  email: string;
  name: string;
  picture?: string;
  ageBand: "kid" | "teen" | "adult";
  skillLevel: "starter" | "explorer" | "builder" | "architect" | "visionary";
  signupAt: number;
  lastSeenAt: number;
  xp: number;
  streak: number;
  tier: GuildTier;
  topInterest?: TopicId;
  daysActive: number;     // distinct active days in last 30
  totalSparks: number;
  totalMinutes: number;
  banned: boolean;
  isCurrentUser?: boolean;
}

export interface AnalyticsCohortRow {
  cohort: string;     // e.g. "2026-W12"
  size: number;
  d1: number;         // %
  d7: number;
  d30: number;
}

export interface AnalyticsBundle {
  totalUsers: number;
  newSignupsByDay: { date: string; count: number }[];   // last 30 days
  funnel: {
    signedUp: number;
    onboarded: number;
    firstSpark: number;
    streak1: number;
    streak7: number;
  };
  dau: number;
  wau: number;
  mau: number;
  avgSparksPerUser: number;
  avgMinutesPerUser: number;
  topicPopularity: { topicId: TopicId; sparks: number }[];
  retention: AnalyticsCohortRow[];
  emailsSentLast7Days: number;
}
