import type {
  BoardPeriod,
  BoardScope,
  FollowEdge,
  FollowStatus,
  PlayerSnapshot,
  ProfilePatch,
  PublicProfile,
  ReportReason,
  SocialService,
  SocialStatus,
  StreamCard,
} from "./types";
import {
  baseHandleFromEmail,
  firstNameFrom,
  resolveDisplayName,
} from "./handles";
import type { GuildTier, TopicId } from "../types";

/**
 * Offline social service — single-tenant, localStorage only. Used when:
 *  - the admin has `flags.socialEnabled = false` (default), or
 *  - no `socialServerUrl` is configured, or
 *  - the player isn't signed in yet.
 *
 * The point isn't to fake a network. It's to keep the new screens (Profile,
 * Settings → Network, Boards, Spark Stream) usable offline so a clean clone
 * of the repo Just Works without standing up `social-svc`. Mirrors the
 * `OfflineMemoryService` precedent.
 *
 *  - `getMyProfile` / `getProfile(myHandle)` reflect locally-edited state.
 *  - `follow` / `block` / `report` accept the call but return a sentinel edge,
 *    so UIs stay reactive (the caller gets a friendly toast separately).
 *  - Boards / Stream return `[]`; a fork can wire deterministic mock data
 *    above this layer if it wants populated screens for screenshots.
 */

interface OfflineState {
  /** The owner-side profile fields — what the user has set. */
  profile: {
    email: string;
    handle: string;
    fullName?: string;
    pictureUrl?: string;
    profileMode: "open" | "closed";
    showFullName: boolean;
    showCurrent: boolean;
    showMap: boolean;
    showActivity: boolean;
    showBadges: boolean;
    showSignup: boolean;
    signalsGlobal: boolean;
    ageBandIsKid: boolean;
    signupAt: number;
  };
  /** Aggregated stats (last seen via pushSnapshot). */
  aggregate: {
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
  };
  signals: TopicId[];
  /** Local follow edges — useful for forks that fork the engine without a backend. */
  followingOut: FollowEdge[];
  followingIn: FollowEdge[];
  blocked: string[];
  /** Local report log — surfaced on AdminModeration when offline. */
  reports: Array<{
    targetHandle: string;
    reason: ReportReason;
    note?: string;
    at: number;
  }>;
}

const STORAGE_KEY_PREFIX = "learnai:social:offline:";

function defaultState(email: string, ageBandIsKid: boolean): OfflineState {
  return {
    profile: {
      email,
      handle: baseHandleFromEmail(email),
      fullName: undefined,
      pictureUrl: undefined,
      // Kid profiles forced to closed, no override.
      profileMode: ageBandIsKid ? "closed" : "open",
      showFullName: false,
      showCurrent: true,
      showMap: true,
      showActivity: true,
      showBadges: true,
      showSignup: true,
      signalsGlobal: true,
      ageBandIsKid,
      signupAt: Date.now(),
    },
    aggregate: {
      xpTotal: 0,
      xpWeek: 0,
      xpMonth: 0,
      streak: 0,
      guildTier: "Builder",
      badges: [],
      topicXp: {},
      activity14d: new Array(14).fill(0),
    },
    signals: [],
    followingOut: [],
    followingIn: [],
    blocked: [],
    reports: [],
  };
}

export class OfflineSocialService implements SocialService {
  private readonly storageKey: string;
  private readonly email: string;
  private readonly ageBandIsKid: boolean;

  constructor(opts: { email: string; ageBandIsKid?: boolean }) {
    this.email = opts.email || "anon";
    this.ageBandIsKid = !!opts.ageBandIsKid;
    this.storageKey = `${STORAGE_KEY_PREFIX}${this.email}`;
  }

  // -- internal storage -----------------------------------------------------

  private read(): OfflineState {
    if (typeof window === "undefined") return defaultState(this.email, this.ageBandIsKid);
    try {
      const raw = window.localStorage.getItem(this.storageKey);
      if (!raw) return defaultState(this.email, this.ageBandIsKid);
      const parsed = JSON.parse(raw) as Partial<OfflineState>;
      // Forward-merge so older saved states inherit new defaults.
      const base = defaultState(this.email, this.ageBandIsKid);
      const profile = { ...base.profile, ...(parsed.profile ?? {}) };
      // ageBandIsKid is a *derived* property — always source it from the
      // constructor arg (which the SocialProvider keeps in sync with the
      // player's current profile), never from cached localStorage state.
      // This also enforces the kid → closed safety rule even if a stale
      // saved state has profileMode=open.
      profile.ageBandIsKid = this.ageBandIsKid;
      if (this.ageBandIsKid) profile.profileMode = "closed";
      return {
        profile,
        aggregate: { ...base.aggregate, ...(parsed.aggregate ?? {}) },
        signals: parsed.signals ?? base.signals,
        followingOut: parsed.followingOut ?? base.followingOut,
        followingIn: parsed.followingIn ?? base.followingIn,
        blocked: parsed.blocked ?? base.blocked,
        reports: parsed.reports ?? base.reports,
      };
    } catch {
      return defaultState(this.email, this.ageBandIsKid);
    }
  }

  private write(state: OfflineState): void {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(this.storageKey, JSON.stringify(state));
  }

  // -- projection -----------------------------------------------------------

  private toPublic(state: OfflineState, viewerIsOwner: boolean): PublicProfile {
    // P1-9 fix: owner always sees their full name (preview); non-owners
    // see it only when the owner has opted to expose it.
    const showFull = viewerIsOwner ? true : state.profile.showFullName;
    return {
      // P0-3 fix: email is owner-only on the wire. Visitors see empty.
      email: viewerIsOwner ? state.profile.email : "",
      handle: state.profile.handle,
      displayName: resolveDisplayName({
        fullName: state.profile.fullName,
        showFullName: showFull,
        email: state.profile.email,
      }),
      pictureUrl: state.profile.pictureUrl,
      guildTier: state.aggregate.guildTier,
      streak: state.aggregate.streak,
      xpTotal: state.aggregate.xpTotal,
      signals: state.signals,
      badges: viewerIsOwner || state.profile.showBadges ? state.aggregate.badges : [],
      ageBandIsKid: state.profile.ageBandIsKid,
      profileMode: state.profile.profileMode,
      signupAt: state.profile.signupAt,
      currentWork:
        viewerIsOwner || state.profile.showCurrent
          ? state.aggregate.currentTopicId && state.aggregate.currentLevel != null
            ? {
                topicId: state.aggregate.currentTopicId,
                level: state.aggregate.currentLevel,
                topicName: state.aggregate.currentTopicId,
              }
            : undefined
          : undefined,
      topicMap:
        viewerIsOwner || state.profile.showMap
          ? Object.entries(state.aggregate.topicXp).map(([topicId, xp]) => ({
              topicId: topicId as TopicId,
              xp: xp ?? 0,
            }))
          : undefined,
      activity14d:
        viewerIsOwner || state.profile.showActivity ? state.aggregate.activity14d : undefined,
      ownerPrefs: viewerIsOwner
        ? {
            fullName: state.profile.fullName,
            showFullName: state.profile.showFullName,
            showCurrent: state.profile.showCurrent,
            showMap: state.profile.showMap,
            showActivity: state.profile.showActivity,
            showBadges: state.profile.showBadges,
            showSignup: state.profile.showSignup,
            signalsGlobal: state.profile.signalsGlobal,
          }
        : undefined,
    };
  }

  // -- read -----------------------------------------------------------------

  async getMyProfile(): Promise<PublicProfile> {
    return this.toPublic(this.read(), true);
  }

  async getProfile(handle: string): Promise<PublicProfile | null> {
    const state = this.read();
    if (state.profile.handle.toLowerCase() === handle.toLowerCase()) {
      return this.toPublic(state, false);
    }
    return null;
  }

  async listFollowing(opts: { status?: FollowStatus } = {}): Promise<FollowEdge[]> {
    const all = this.read().followingOut;
    return opts.status ? all.filter((e) => e.status === opts.status) : all;
  }

  async listFollowers(opts: { status?: FollowStatus } = {}): Promise<FollowEdge[]> {
    const all = this.read().followingIn;
    return opts.status ? all.filter((e) => e.status === opts.status) : all;
  }

  async listPendingIncoming(): Promise<FollowEdge[]> {
    return this.read().followingIn.filter((e) => e.status === "pending");
  }

  async listPendingOutgoing(): Promise<FollowEdge[]> {
    return this.read().followingOut.filter((e) => e.status === "pending");
  }

  async listBlocked(): Promise<string[]> {
    return this.read().blocked.slice();
  }

  async getBoard(_scope: BoardScope, _period: BoardPeriod): Promise<PublicProfile[]> {
    // Offline: only the local player is "in" the social graph. Return an
    // empty list — callers seed deterministic mocks above this layer.
    return [];
  }

  async getStream(_opts?: { limit?: number; before?: number }): Promise<StreamCard[]> {
    return [];
  }

  // -- write (profile) ------------------------------------------------------

  async updateProfile(patch: ProfilePatch): Promise<PublicProfile> {
    const state = this.read();
    // Kid profiles cannot leave Closed mode.
    if (state.profile.ageBandIsKid && patch.profileMode === "open") {
      patch = { ...patch, profileMode: "closed" };
    }
    const next: OfflineState = {
      ...state,
      profile: { ...state.profile, ...patch },
    };
    this.write(next);
    return this.toPublic(next, true);
  }

  async setSignals(topics: TopicId[]): Promise<TopicId[]> {
    // Hard cap at 5 (mirrors the engineering plan).
    const capped = Array.from(new Set(topics)).slice(0, 5);
    const state = this.read();
    this.write({ ...state, signals: capped });
    return capped;
  }

  async pushSnapshot(snapshot: PlayerSnapshot): Promise<void> {
    const state = this.read();
    const next: OfflineState = {
      ...state,
      aggregate: {
        xpTotal: snapshot.xpTotal,
        xpWeek: snapshot.xpWeek,
        xpMonth: snapshot.xpMonth,
        streak: snapshot.streak,
        guildTier: snapshot.guildTier,
        currentTopicId: snapshot.currentTopicId,
        currentLevel: snapshot.currentLevel,
        badges: snapshot.badges,
        topicXp: snapshot.topicXp,
        activity14d: snapshot.activity14d.slice(0, 14),
      },
    };
    this.write(next);
  }

  // -- write (graph) --------------------------------------------------------

  async follow(targetHandle: string): Promise<FollowEdge> {
    const state = this.read();
    const existing = state.followingOut.find(
      (e) => e.target.toLowerCase() === targetHandle.toLowerCase(),
    );
    if (existing) return existing;
    const edge: FollowEdge = {
      follower: this.email,
      target: targetHandle,
      status: "approved", // offline can't gate by remote profile mode
      muted: false,
      createdAt: Date.now(),
      approvedAt: Date.now(),
    };
    this.write({ ...state, followingOut: [edge, ...state.followingOut] });
    return edge;
  }

  async unfollow(targetHandle: string): Promise<void> {
    const state = this.read();
    this.write({
      ...state,
      followingOut: state.followingOut.filter(
        (e) => e.target.toLowerCase() !== targetHandle.toLowerCase(),
      ),
    });
  }

  async approveFollowRequest(followerEmail: string): Promise<void> {
    const state = this.read();
    this.write({
      ...state,
      followingIn: state.followingIn.map((e) =>
        e.follower.toLowerCase() === followerEmail.toLowerCase() && e.status === "pending"
          ? { ...e, status: "approved", approvedAt: Date.now() }
          : e,
      ),
    });
  }

  async declineFollowRequest(followerEmail: string): Promise<void> {
    const state = this.read();
    this.write({
      ...state,
      followingIn: state.followingIn.filter(
        (e) => e.follower.toLowerCase() !== followerEmail.toLowerCase() || e.status !== "pending",
      ),
    });
  }

  async cancelMyPendingRequest(targetHandle: string): Promise<void> {
    const state = this.read();
    this.write({
      ...state,
      followingOut: state.followingOut.filter(
        (e) => e.target.toLowerCase() !== targetHandle.toLowerCase() || e.status !== "pending",
      ),
    });
  }

  async setMuted(targetHandle: string, muted: boolean): Promise<void> {
    const state = this.read();
    this.write({
      ...state,
      followingOut: state.followingOut.map((e) =>
        e.target.toLowerCase() === targetHandle.toLowerCase() ? { ...e, muted } : e,
      ),
    });
  }

  async block(targetHandle: string): Promise<void> {
    const state = this.read();
    if (state.blocked.includes(targetHandle)) return;
    // Block precedence: also remove any pending or approved edges.
    this.write({
      ...state,
      blocked: [targetHandle, ...state.blocked],
      followingOut: state.followingOut.filter(
        (e) => e.target.toLowerCase() !== targetHandle.toLowerCase(),
      ),
      followingIn: state.followingIn.filter(
        (e) => e.follower.toLowerCase() !== targetHandle.toLowerCase(),
      ),
    });
  }

  async unblock(targetEmail: string): Promise<void> {
    const state = this.read();
    this.write({
      ...state,
      blocked: state.blocked.filter((b) => b.toLowerCase() !== targetEmail.toLowerCase()),
    });
  }

  async report(
    targetHandle: string,
    reason: ReportReason,
    note?: string,
    _context?: Record<string, unknown>,
  ): Promise<void> {
    const state = this.read();
    this.write({
      ...state,
      reports: [
        ...state.reports,
        { targetHandle, reason, note, at: Date.now() },
      ].slice(-100),
    });
    // Also auto-mute on report (per PRD §4.1).
    if (state.followingOut.some((e) => e.target.toLowerCase() === targetHandle.toLowerCase())) {
      await this.setMuted(targetHandle, true);
    }
  }

  // -- meta -----------------------------------------------------------------

  async health(): Promise<SocialStatus> {
    return { ok: true, backend: "offline" };
  }
}

/** Test helper: return the raw offline state for the current user. */
export function readOfflineSocialState(email: string): OfflineState {
  if (typeof window === "undefined") return defaultState(email, false);
  try {
    const raw = window.localStorage.getItem(`${STORAGE_KEY_PREFIX}${email || "anon"}`);
    if (!raw) return defaultState(email, false);
    return JSON.parse(raw) as OfflineState;
  } catch {
    return defaultState(email, false);
  }
}

/** Display helper used by tests and the Network UI. */
export function firstName(p: { fullName?: string; email: string }): string {
  return firstNameFrom(p.fullName, p.email);
}
