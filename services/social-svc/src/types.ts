// Server-side type definitions. Mirror app/src/social/types.ts but
// belong to the service so the service can compile + run independently.
// (Keeping them duplicated rather than shared because the service is a
// separate npm package and this avoids cross-package import gymnastics.
// The two files must be kept in sync — both are short.)

export type ProfileMode = "open" | "closed";
export type GuildTier =
  | "Builder"
  | "Architect"
  | "Visionary"
  | "Founder"
  | "Singularity";

export interface ProfileRecord {
  email: string;
  handle: string;
  displayFirst: string;
  fullName?: string;
  pictureUrl?: string;
  ageBand: "kid" | "teen" | "adult";
  profileMode: ProfileMode;
  showFullName: boolean;
  showCurrent: boolean;
  showMap: boolean;
  showActivity: boolean;
  showBadges: boolean;
  showSignup: boolean;
  signalsGlobal: boolean;
  signals: string[];
  banned: boolean;
  bannedSocial: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface AggregateRecord {
  email: string;
  xpTotal: number;
  xpWeek: number;
  xpMonth: number;
  streak: number;
  guildTier: GuildTier;
  currentTopicId?: string;
  currentLevel?: number;
  badges: string[];
  topicXp: Record<string, number>;
  activity14d: number[];
  lastEventAt?: number;
  updatedAt: number;
}

export type FollowStatus = "approved" | "pending";

export interface FollowEdge {
  follower: string;
  target: string;
  status: FollowStatus;
  muted: boolean;
  createdAt: number;
  approvedAt?: number;
}

export interface BlockEdge {
  blocker: string;
  blocked: string;
  createdAt: number;
}

export type ReportReason =
  | "spam"
  | "harassment"
  | "off-topic"
  | "impersonation"
  | "other";

export interface ReportRecord {
  id: number;
  reporter: string;
  reported: string;
  reason: ReportReason;
  note?: string;
  context?: Record<string, unknown>;
  status: "open" | "resolved" | "dismissed";
  resolution?: string;
  resolvedBy?: string;
  createdAt: number;
  resolvedAt?: number;
}

export interface PublicProfile {
  email: string;
  handle: string;
  displayName: string;
  pictureUrl?: string;
  guildTier: GuildTier;
  streak: number;
  xpTotal: number;
  signals: string[];
  badges: string[];
  ageBandIsKid: boolean;
  profileMode: ProfileMode;
  signupAt: number;
  currentWork?: { topicId: string; level: number; topicName: string };
  topicMap?: { topicId: string; xp: number }[];
  activity14d?: number[];
  ownerPrefs?: {
    fullName?: string;
    showFullName: boolean;
    showCurrent: boolean;
    showMap: boolean;
    showActivity: boolean;
    showBadges: boolean;
    showSignup: boolean;
    signalsGlobal: boolean;
  };
}

export type StreamCardKind =
  | "level_up"
  | "boss_beaten"
  | "streak_milestone"
  | "spotlight";

export interface StreamEventRecord {
  id: number;
  email: string;
  kind: StreamCardKind;
  topicId?: string;
  level?: number;
  detail?: Record<string, unknown>;
  createdAt: number;
}

export interface PlayerSnapshot {
  xpTotal: number;
  xpWeek: number;
  xpMonth: number;
  streak: number;
  guildTier: GuildTier;
  currentTopicId?: string;
  currentLevel?: number;
  badges: string[];
  topicXp: Record<string, number>;
  activity14d: number[];
  events: Array<{
    kind: StreamCardKind;
    topicId?: string;
    level?: number;
    detail?: Record<string, unknown>;
    clientId: string;
  }>;
  clientWindow: { from: number; to: number };
}
