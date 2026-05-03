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

export interface ProfileLinks {
  linkedin?: string;
  github?: string;
  twitter?: string;
  website?: string;
}

export type SkillLevel =
  | "starter"
  | "explorer"
  | "builder"
  | "architect"
  | "visionary";

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
  // -- extended metadata (SPA #112) -------------------------------------
  // All optional + ignored if absent; older saved records hydrate fine.
  bio?: string;
  pronouns?: string;
  location?: string;
  heroUrl?: string;
  skillLevel?: SkillLevel;
  links?: ProfileLinks;
  showBio?: boolean;
  showPronouns?: boolean;
  showLocation?: boolean;
  showHero?: boolean;
  showSkillLevel?: boolean;
  showLinks?: boolean;
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
  // -- extended metadata (PR #112). Each is gated by the matching
  // `show*` flag for non-owners; owners always see their own values.
  bio?: string;
  pronouns?: string;
  location?: string;
  heroUrl?: string;
  skillLevel?: SkillLevel;
  links?: ProfileLinks;
  ownerPrefs?: {
    fullName?: string;
    showFullName: boolean;
    showCurrent: boolean;
    showMap: boolean;
    showActivity: boolean;
    showBadges: boolean;
    showSignup: boolean;
    signalsGlobal: boolean;
    // Extended-metadata visibility flags (PR #112).
    showBio?: boolean;
    showPronouns?: boolean;
    showLocation?: boolean;
    showHero?: boolean;
    showSkillLevel?: boolean;
    showLinks?: boolean;
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

// Site visit, recorded by the SPA's anonymous tracking beacon. Holds
// only what's needed to do source attribution ("did traffic come from
// my Twitter post?") — no IPs, no UAs, no PII. Bounded to N rows.
export interface VisitRecord {
  /** Server-stamped epoch ms. */
  ts: number;
  /** SPA pathname (e.g. "/", "/topic/agents"). Never the full URL. */
  path: string;
  /**
   * Normalized referrer:
   *   - "(direct)"   — no Referer header (bookmark, paste, app handoff)
   *   - "(internal)" — same-origin nav inside the SPA
   *   - bare host    — e.g. "twitter.com", "news.ycombinator.com"
   */
  refDomain: string;
  /**
   * Marketing source — first match of `?utm_source=`, `?ref=`, or
   * `?from=`, lowercased + trimmed. null when none of those are
   * present. This is the field that lets the operator tell "post X
   * brought 12 visits" if they shared the URL with `?ref=ozs_blog`.
   */
  source: string | null;
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
