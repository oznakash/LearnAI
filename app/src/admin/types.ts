import type { Creator, CreatorId, GuildTier, Topic, TopicId } from "../types";

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
  | "smtp-relay"      // POSTs to your own backend / n8n / Make / etc. that speaks SMTP
  | "smtp-our-server" // POSTs to social-svc /v1/email/send → uses our own SMTP server (env-configured)
  | "emailjs"         // EmailJS (purpose-built for browser → SMTP)
  | "postmark"
  | "sendgrid"
  | "ses";            // ses + smtp left for future server-side

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
   * @deprecated kept for migration only. Cognition is on by default for
   * everyone now. The previous "global kill switch" semantics confused
   * the player privacy model and had a stale-cache race that defaulted
   * users into offline mode unintentionally. The store loader migrates
   * any saved `offlineMode: true` to `false` on read.
   */
  offlineMode?: boolean;
  /**
   * When true, players see a "Let LearnAI remember things about me"
   * toggle in Settings and can opt themselves out of the cognition
   * layer. When false (default), every signed-in user is on the
   * cognition layer — no per-user opt-out.
   *
   * The privacy promise: cognition is on by default for everyone, but
   * the operator can flip this if their cohort needs the off-switch.
   */
  memoryPlayerOptIn: boolean;
  /**
   * When true, the deterministic 30-user demo cohort is folded into the
   * Admin → Users + Analytics views (alongside the real signed-in user).
   * Useful for screenshots, demos, and stress-testing the UI; off by
   * default so a clean production deployment doesn't surface fake users.
   */
  showDemoData: boolean;
  /**
   * Master switch for the social layer (Profile, Followers/Following,
   * Topic Leaderboards, Spark Stream, Network settings). When false
   * (default), the social UI is hidden and `SocialService` is the offline
   * impl. When true, the SPA expects a configured `socialConfig.serverUrl`
   * pointing at `social-svc` (via the auth-verifying proxy).
   *
   * Sub-flags below let an admin enable the layer but disable specific
   * surfaces (e.g. ship Profile + Boards, hide Stream while it bakes).
   */
  socialEnabled: boolean;
  /** Show the Spark Stream tab + on-Home rail when true. Requires socialEnabled. */
  streamEnabled: boolean;
  /** Show the Topic Leaderboards (Boards) view when true. Requires socialEnabled. */
  boardsEnabled: boolean;
  /** Default privacy mode for newly-onboarded profiles. */
  defaultProfileMode: "open" | "closed";
  /**
   * Master switch for the Lenny's Podcast content seam (PodcastNugget Sparks).
   * When true (default), curated ≤ 60-word nuggets from Lenny's Podcast guests
   * are surfaced inside the relevant Constellations. When false, the topic
   * loader strips every PodcastNugget Spark before topics reach the UI — so
   * the operator can turn the seam off with one toggle if Lenny ever asks
   * us to. See `docs/lenny-archive.md` for the curation + attribution policy.
   */
  lennyContentEnabled: boolean;
}

/**
 * Production server-side sign-in.
 *
 * - `mode: "demo"` (the default for forks) — current local-only sign-in:
 *   the SPA decodes the Google ID token client-side, no server verification,
 *   no cross-device sessions. Useful for someone cloning the repo locally
 *   with no backend.
 * - `mode: "production"` — the SPA hands the Google ID token to the mem0
 *   server (POST /auth/google), which verifies it and returns a 7-day
 *   session JWT. The session JWT is then used as the bearer for all mem0
 *   calls and gates admin-only UI (via `is_admin` claim from ADMIN_EMAILS).
 *
 * `googleClientId` and `mem0Url` are public values — safe to bake into the
 * SPA bundle. Defaults are read from `import.meta.env.VITE_*` at build time.
 */
export interface ServerAuthConfig {
  mode: "demo" | "production";
  googleClientId: string;
  mem0Url: string;
}

export interface SocialConfig {
  /** Base URL of the self-hosted `social-svc` (or the auth-proxy in production). */
  serverUrl: string;
  /** Bearer for the social server. In production we use the player's session JWT. */
  apiKey?: string;
  /** Cap on per-player Signals (Topic discoverability tags). */
  signalsMaxPerUser: number;
  /** Cap on outbound follow links per player (anti-spam). */
  followsMaxOutbound: number;
  /** Per-email per-day max reports. Above this, requests 429. */
  reportsPerEmailPerDay: number;
  /** Spark Stream ranking weights — admin-tunable, no engagement signal. */
  streamWeights: {
    recencyHalfLifeHours: number;
    follow: number;
    signalOverlap: number;
    qualityTier: number;
  };
  /**
   * Operator-level policy for the public profile page (`/u/<handle>`).
   *
   * The Network view lets each user toggle individual visibility flags
   * (`showCurrent`, `showMap`, `showActivity`, `showBadges`, `showSignup`,
   * `showFullName`, `signalsGlobal`). These admin-level settings are the
   * defaults a fresh sign-up starts from, plus master switches the
   * operator can flip globally. The /admin → Public Profile tab is the
   * UI for editing them.
   *
   * Forward-compat note: this is read by the Network view at v1; the
   * social-svc lazy-create flow honors them in a follow-up. The current
   * profile bools live in localStorage admin config (cross-device synced
   * via mem0); persisting them to the server is a future PR.
   */
  publicProfile: {
    /** What `profileMode` a brand-new sign-up starts in. */
    defaultProfileMode: "open" | "closed";
    /** Defaults for the per-field visibility toggles in Network view. */
    defaults: {
      showFullName: boolean;
      showCurrent: boolean;
      showMap: boolean;
      showActivity: boolean;
      showBadges: boolean;
      showSignup: boolean;
      signalsGlobal: boolean;
    };
    /**
     * Master switch for the SSR personalized-learnings section on
     * `/u/<handle>`. When false, the SSR public profile renders the
     * basic header + activity sparkline only (closed-gate style).
     * When true (default), every Signal topic renders its full
     * `<details>` with intro + whatYoudLearn + 5 sample sparks.
     */
    showLearningContent: boolean;
  };
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
  logoEmoji: string;       // 1–4 chars for the brand tile
  /** The buddy / mascot's name. Shown in greetings, error pages, leaderboard mocks. */
  mascotName: string;
  /** The XP unit's display name. Shown wherever XP appears in the UI. */
  xpUnit: string;
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

/**
 * Operator-tunable rate-limit / dedup / pause / opt-out settings for
 * the email pipeline. flushQueue consults these before any provider
 * call. Defaults are anti-spam: cap on, 24h window, debounced auto-
 * flush, unsubscribe + open-pixel auto-injected.
 */
export interface EmailPolicy {
  /** Master switch. When false, the queue behaves like the original
   *  manual-flush, no-cap, no-injection version. */
  enabled: boolean;
  /** Cap window in hours. Default 24. */
  capPerWindowHours: number;
  /** When true, transactional templates (`first-spark`, `welcome`,
   *  `level-up`, `boss-beaten`, `streak-save`) bypass the cap.
   *  Default false — operator-side caution beats operator-side trust. */
  transactionalBypass: boolean;
  /** Auto-flush debounce. Time in seconds we wait after the last
   *  queue event before sending. Lets us collect competing
   *  transactionals (welcome + first-spark fired 2s apart) and pick
   *  one. Default 30. */
  autoFlushDebounceSeconds: number;
  /** When true, the queue auto-flushes on a debounced timer. When
   *  false, only manual "Mark all sent" sends. Default true. */
  autoFlushEnabled: boolean;
  /** Append a one-click unsubscribe link to every send. Default true. */
  appendUnsubscribe: boolean;
  /** Embed a 1×1 open-tracking pixel in every send. Default true. */
  appendOpenPixel: boolean;
  /** When N consecutive emails are sent without an open and the most
   *  recent is at least 24h old, pause sending to that user for
   *  `pauseDurationDays`. Default {2 unread, 30 days}. */
  pauseOnUnreadEnabled: boolean;
  pauseOnUnreadCount: number;
  pauseDurationDays: number;
  /** Highest priority first. When the same recipient has multiple
   *  queued sends in a single flush window, the lowest-index one wins
   *  and the rest are marked superseded. */
  priorityOrder: EmailTemplateId[];
}

export interface AdminConfig {
  bootstrapped: boolean;
  admins: string[];               // gmail addresses
  branding: Branding;
  flags: FeatureFlags;
  defaultDailyMinutes: number;
  emailConfig: EmailConfig;
  emailPolicy: EmailPolicy;
  emailTemplates: Record<EmailTemplateId, EmailTemplate>;
  perUserDailyTokenCap: number;   // 0 = unlimited
  emailQueue: QueuedEmail[];
  tuning: GameTuning;
  contentOverrides: ContentOverrides;
  /**
   * Creator registry — external content sources Sparks credit (podcasts,
   * newsletters, channels, blogs). Merged on top of the seed registry in
   * `app/src/content/creators.ts`. Sparks reference creators by id.
   *
   * Operators add / edit / remove creators in Admin → Creators. Removing a
   * creator is blocked while any Spark still references it.
   */
  creators: Record<CreatorId, Creator>;
  promptStudio: PromptStudioState;
  memoryConfig: MemoryConfig;
  socialConfig: SocialConfig;
  serverAuth: ServerAuthConfig;
}

export interface QueuedEmail {
  id: string;
  to: string;
  templateId: EmailTemplateId;
  subjectRendered: string;
  bodyRendered: string;
  queuedAt: number;
  /**
   * `queued` — waiting for the next flush (auto or manual).
   * `sent` / `failed` — terminal, set by the provider call.
   * `superseded` — another queued email beat this one on priority for
   *   the same recipient inside one flush window.
   * `rate-limited` — recipient already received a send inside the
   *   `capPerWindowHours` window.
   * `unsubscribed` — recipient has `emailUnsubscribedAt` set.
   * `paused` — recipient is in the pause-on-unread cooldown.
   */
  status:
    | "queued"
    | "sent"
    | "failed"
    | "superseded"
    | "rate-limited"
    | "unsubscribed"
    | "paused";
  error?: string;
  /** Server-side log id minted by mem0's `prepare` endpoint when this
   *  send actually fired. Correlates later opens with this entry. */
  prepareLogId?: string;
  /** Server-side decision returned by mem0's `prepare` endpoint. */
  serverDecision?: string;
  /**
   * Signed one-click unsubscribe URL (mem0-minted, HMAC-validated).
   * sender.ts uses this to build provider-specific
   * `List-Unsubscribe` + `List-Unsubscribe-Post` headers (RFC 8058)
   * so Gmail's native Unsubscribe pill shows up.
   */
  unsubscribeUrl?: string;
  /** Open-tracking pixel URL — already injected into the rendered
   *  body in flushQueue, kept here for diagnosis. */
  openPixelUrl?: string;
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
