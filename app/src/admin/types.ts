import type { GuildTier, TopicId } from "../types";

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

export type EmailProvider = "smtp" | "resend" | "postmark" | "sendgrid" | "ses" | "none";

export interface EmailConfig {
  provider: EmailProvider;
  apiKey?: string;     // for resend/postmark/sendgrid
  smtp?: {
    host: string;
    port: number;
    secure: boolean;
    username: string;
    password: string;  // stored client-side; warn user this is for demo
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
}

export interface Branding {
  appName: string;
  tagline: string;
  accentColor: string;     // hex
  accent2Color: string;    // hex
  logoEmoji: string;       // for the BQ tile
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
