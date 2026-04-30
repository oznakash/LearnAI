/**
 * Types for the social layer.
 *
 * The social layer is the second self-hosted backend in the LearnAI
 * architecture (mem0 is the first). It owns *public-shaped* data only:
 * profiles, follows, blocks, reports, signals, stream events. Every type
 * here is safe to expose across users — never any cognition (memory)
 * content, never any raw answers, never any PII beyond email + first name.
 *
 * See `docs/social-mvp-product.md` (PRD) and
 * `docs/social-mvp-engineering.md` (engineering plan) for the rationale.
 */

import type { GuildTier, TopicId } from "../types";

/** Two values: discoverable to all (`open`), or gated by approval (`closed`). */
export type ProfileMode = "open" | "closed";

/**
 * The viewer-resolved public projection of a profile. The same shape is
 * returned by both the offline and online services. Optional sections are
 * `undefined` either because the owner has hidden them (Open profile with
 * field-level controls) or because the profile is Closed and the viewer
 * is not yet approved.
 */
export interface PublicProfile {
  /** Gmail. Never displayed to viewers; needed for follow operations. */
  email: string;
  /** Lowercased, disambiguated handle. URL-safe. e.g. `maya`, `maya2`. */
  handle: string;
  /** Resolved per-viewer: first name only by default; full name if shown. */
  displayName: string;
  pictureUrl?: string;
  guildTier: GuildTier;
  streak: number;
  xpTotal: number;
  /** The Topics this profile has opted into being discoverable for. */
  signals: TopicId[];
  badges: string[];
  /**
   * Viewer-side decisions only. Never reveals exact age. We expose only
   * "is this profile a kid" so the viewer's UI can apply safety rules.
   */
  ageBandIsKid: boolean;
  profileMode: ProfileMode;
  /** Unix ms; the month/year is the only piece a viewer sees. */
  signupAt: number;
  /** What this player is currently working on, if shown. */
  currentWork?: { topicId: TopicId; level: number; topicName: string };
  /** The "Topic map" — chip cloud of topics with progress. */
  topicMap?: { topicId: TopicId; xp: number }[];
  /** Last 14 daily-Spark counts, oldest first. */
  activity14d?: number[];
}

export type FollowStatus = "approved" | "pending";

export interface FollowEdge {
  /** The player doing the following. */
  follower: string;
  /** The player being followed. */
  target: string;
  status: FollowStatus;
  /** Whether the follower has muted the target. */
  muted: boolean;
  createdAt: number;
  approvedAt?: number;
}

export type StreamCardKind =
  | "level_up"
  | "boss_beaten"
  | "streak_milestone"
  | "spotlight";

export interface StreamCard {
  id: string;
  authorHandle: string;
  authorDisplay: string;
  authorPicture?: string;
  authorTier: GuildTier;
  topicId?: TopicId;
  topicName?: string;
  level?: number;
  kind: StreamCardKind;
  detail?: Record<string, unknown>;
  createdAt: number;
  /** Whether the viewer is already following the author. */
  iAmFollowing: boolean;
  /** Whether the viewer can follow the author (false for blocked / closed-without-pending). */
  iCanFollow: boolean;
}

export type ReportReason =
  | "spam"
  | "harassment"
  | "off-topic"
  | "impersonation"
  | "other";

export type BoardScope = "global" | "following" | { topicId: TopicId };
export type BoardPeriod = "week" | "month" | "all";

export interface SocialStatus {
  ok: boolean;
  backend: "offline" | "online";
  reason?: string;
  details?: Record<string, unknown>;
}

/**
 * The viewer's editable patch over their own profile. Cannot change the
 * derived/aggregated fields (xp, streak, etc.) — those flow from
 * snapshots; see `PlayerSnapshot`.
 */
export type ProfilePatch = Partial<{
  /** Owner's stored full name; visible to others only if `showFullName=true`. */
  fullName: string;
  pictureUrl: string;
  profileMode: ProfileMode;
  showFullName: boolean;
  showCurrent: boolean;
  showMap: boolean;
  showActivity: boolean;
  showBadges: boolean;
  showSignup: boolean;
  /** Show on the Global Leaderboard (independent of per-Topic Signals). */
  signalsGlobal: boolean;
}>;

/**
 * What the SPA POSTs after every state change. Server-side upsert is
 * idempotent on `(email, clientWindow.to)`. The SPA owns source of truth
 * for game state — social-svc has *no* game logic, only a public-safe
 * projection of it.
 */
export interface PlayerSnapshot {
  xpTotal: number;
  xpWeek: number;
  xpMonth: number;
  streak: number;
  guildTier: GuildTier;
  currentTopicId?: TopicId;
  currentLevel?: number;
  badges: string[];
  topicXp: Partial<Record<TopicId, number>>;
  activity14d: number[];
  /** New events since prev. Each has a stable `clientId` for idempotency. */
  events: Array<{
    kind: StreamCardKind;
    topicId?: TopicId;
    level?: number;
    detail?: Record<string, unknown>;
    clientId: string;
  }>;
  /** Window the SPA is reporting for. Server upserts on `to`. */
  clientWindow: { from: number; to: number };
}

/**
 * Narrow surface — every social interaction goes through here. Two
 * implementations: `OfflineSocialService` (localStorage) and
 * `OnlineSocialService` (HTTP). The active one is selected at runtime by
 * `selectSocialService(...)`; the rest of the app is implementation-blind.
 */
export interface SocialService {
  // -- read --
  getMyProfile(): Promise<PublicProfile>;
  getProfile(handle: string): Promise<PublicProfile | null>;
  listFollowing(opts?: { status?: FollowStatus }): Promise<FollowEdge[]>;
  listFollowers(opts?: { status?: FollowStatus }): Promise<FollowEdge[]>;
  listPendingIncoming(): Promise<FollowEdge[]>;
  listPendingOutgoing(): Promise<FollowEdge[]>;
  listBlocked(): Promise<string[]>;
  getBoard(scope: BoardScope, period: BoardPeriod): Promise<PublicProfile[]>;
  getStream(opts?: { limit?: number; before?: number }): Promise<StreamCard[]>;

  // -- write (profile) --
  updateProfile(patch: ProfilePatch): Promise<PublicProfile>;
  setSignals(topics: TopicId[]): Promise<TopicId[]>;
  pushSnapshot(snapshot: PlayerSnapshot): Promise<void>;

  // -- write (graph) --
  follow(targetHandle: string): Promise<FollowEdge>;
  unfollow(targetHandle: string): Promise<void>;
  approveFollowRequest(followerEmail: string): Promise<void>;
  declineFollowRequest(followerEmail: string): Promise<void>;
  cancelMyPendingRequest(targetHandle: string): Promise<void>;
  setMuted(targetHandle: string, muted: boolean): Promise<void>;
  block(targetHandle: string): Promise<void>;
  unblock(targetEmail: string): Promise<void>;
  report(
    targetHandle: string,
    reason: ReportReason,
    note?: string,
    context?: Record<string, unknown>
  ): Promise<void>;

  // -- meta --
  health(): Promise<SocialStatus>;
}
