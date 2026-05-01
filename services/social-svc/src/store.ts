// In-memory store with optional JSON-file persistence.
//
// This is the MVP storage layer for social-svc. It mirrors the schema
// described in docs/social-mvp-engineering.md §3.1 (which targets
// Postgres-2 in production), but keeps everything in process memory
// for the first deploy. Forks running social-svc on a long-lived host
// can configure SOCIAL_DB_PATH; the store flushes after every write.
//
// Migration path to Postgres: replace this module with a thin pg
// adapter; the rest of the service is unaware.

import * as fs from "node:fs";
import type {
  AggregateRecord,
  BlockEdge,
  FollowEdge,
  ProfileRecord,
  ReportRecord,
  StreamEventRecord,
} from "./types.js";

interface Snapshot {
  profiles: ProfileRecord[];
  aggregates: AggregateRecord[];
  follows: FollowEdge[];
  blocks: BlockEdge[];
  reports: ReportRecord[];
  events: StreamEventRecord[];
  ids: { reportId: number; eventId: number };
}

export interface Store {
  // Profiles
  upsertProfile(p: ProfileRecord): ProfileRecord;
  getProfileByEmail(email: string): ProfileRecord | null;
  getProfileByHandle(handle: string): ProfileRecord | null;
  isHandleTaken(handle: string): boolean;

  // Aggregates
  upsertAggregate(a: AggregateRecord): AggregateRecord;
  getAggregate(email: string): AggregateRecord | null;

  // Follows
  upsertFollow(e: FollowEdge): FollowEdge;
  removeFollow(follower: string, target: string): void;
  listFollowing(follower: string): FollowEdge[];
  listFollowers(target: string): FollowEdge[];
  getFollow(follower: string, target: string): FollowEdge | null;

  // Blocks
  addBlock(blocker: string, blocked: string): void;
  removeBlock(blocker: string, blocked: string): void;
  listBlocked(blocker: string): string[];
  isBlockedEitherWay(a: string, b: string): boolean;

  // Reports
  insertReport(r: Omit<ReportRecord, "id">): ReportRecord;
  listReports(opts?: { status?: ReportRecord["status"] }): ReportRecord[];
  resolveReport(id: number, by: string, resolution: string): ReportRecord | null;

  // Stream events
  insertEvent(e: Omit<StreamEventRecord, "id">): StreamEventRecord;
  /**
   * Insert if a row with the same `clientId` for this email doesn't
   * already exist. Returns the (existing or newly inserted) row.
   * Closes P0-5: StrictMode double-fires don't multiply rows.
   */
  insertEventIdempotent(
    e: Omit<StreamEventRecord, "id"> & { clientId: string },
  ): StreamEventRecord;
  listEventsSince(sinceMs: number, limit?: number): StreamEventRecord[];

  // Telemetry
  statsSnapshot(): StoreStats;
  /** Identifier surfaced on /health (e.g. "memory-only", "memory+jsonfile", "postgres"). */
  backendName?(): string;

  // Persistence
  flush(): void;
  reset(): void;
}

export interface StoreStats {
  profileCount: number;
  openProfiles: number;
  closedProfiles: number;
  kidProfiles: number;
  followCount: number;
  approvedFollows: number;
  pendingFollows: number;
  blockCount: number;
  reportCount: number;
  openReports: number;
  resolvedReports: number;
  eventCount: number;
  events24h: number;
  eventsByKind: Record<string, number>;
  signalsByTopic: Record<string, number>;
}

export function createStore(opts: { dbPath?: string } = {}): Store {
  const state: Snapshot = {
    profiles: [],
    aggregates: [],
    follows: [],
    blocks: [],
    reports: [],
    events: [],
    ids: { reportId: 0, eventId: 0 },
  };

  // Load persisted state if available.
  if (opts.dbPath && fs.existsSync(opts.dbPath)) {
    try {
      const raw = fs.readFileSync(opts.dbPath, "utf8");
      const parsed = JSON.parse(raw) as Partial<Snapshot>;
      Object.assign(state, parsed);
      // Defensive: ensure arrays exist after a partial load.
      state.profiles ??= [];
      state.aggregates ??= [];
      state.follows ??= [];
      state.blocks ??= [];
      state.reports ??= [];
      state.events ??= [];
      state.ids ??= { reportId: 0, eventId: 0 };
    } catch (e) {
      console.warn("[social-svc] failed to load db file:", (e as Error).message);
    }
  }

  const flush = () => {
    if (!opts.dbPath) return;
    try {
      fs.writeFileSync(opts.dbPath, JSON.stringify(state), "utf8");
    } catch (e) {
      console.warn("[social-svc] failed to flush db file:", (e as Error).message);
    }
  };

  const lc = (s: string) => s.toLowerCase();

  return {
    // Profiles -------------------------------------------------------------
    upsertProfile(p) {
      const idx = state.profiles.findIndex((x) => lc(x.email) === lc(p.email));
      const next = { ...p, updatedAt: Date.now() };
      if (idx >= 0) state.profiles[idx] = next;
      else state.profiles.push(next);
      flush();
      return next;
    },
    getProfileByEmail(email) {
      return state.profiles.find((p) => lc(p.email) === lc(email)) ?? null;
    },
    getProfileByHandle(handle) {
      return state.profiles.find((p) => lc(p.handle) === lc(handle)) ?? null;
    },
    isHandleTaken(handle) {
      return state.profiles.some((p) => lc(p.handle) === lc(handle));
    },

    // Aggregates -----------------------------------------------------------
    upsertAggregate(a) {
      const idx = state.aggregates.findIndex((x) => lc(x.email) === lc(a.email));
      const next = { ...a, updatedAt: Date.now() };
      if (idx >= 0) state.aggregates[idx] = next;
      else state.aggregates.push(next);
      flush();
      return next;
    },
    getAggregate(email) {
      return state.aggregates.find((a) => lc(a.email) === lc(email)) ?? null;
    },

    // Follows --------------------------------------------------------------
    upsertFollow(e) {
      const idx = state.follows.findIndex(
        (x) => lc(x.follower) === lc(e.follower) && lc(x.target) === lc(e.target),
      );
      if (idx >= 0) state.follows[idx] = e;
      else state.follows.push(e);
      flush();
      return e;
    },
    removeFollow(follower, target) {
      state.follows = state.follows.filter(
        (e) => !(lc(e.follower) === lc(follower) && lc(e.target) === lc(target)),
      );
      flush();
    },
    listFollowing(follower) {
      return state.follows.filter((e) => lc(e.follower) === lc(follower));
    },
    listFollowers(target) {
      return state.follows.filter((e) => lc(e.target) === lc(target));
    },
    getFollow(follower, target) {
      return (
        state.follows.find(
          (e) => lc(e.follower) === lc(follower) && lc(e.target) === lc(target),
        ) ?? null
      );
    },

    // Blocks ---------------------------------------------------------------
    addBlock(blocker, blocked) {
      if (
        state.blocks.some(
          (b) => lc(b.blocker) === lc(blocker) && lc(b.blocked) === lc(blocked),
        )
      ) return;
      state.blocks.push({ blocker, blocked, createdAt: Date.now() });
      // Block precedence: removes follow edges in either direction.
      state.follows = state.follows.filter(
        (e) =>
          !(
            (lc(e.follower) === lc(blocker) && lc(e.target) === lc(blocked)) ||
            (lc(e.follower) === lc(blocked) && lc(e.target) === lc(blocker))
          ),
      );
      flush();
    },
    removeBlock(blocker, blocked) {
      state.blocks = state.blocks.filter(
        (b) => !(lc(b.blocker) === lc(blocker) && lc(b.blocked) === lc(blocked)),
      );
      flush();
    },
    listBlocked(blocker) {
      return state.blocks
        .filter((b) => lc(b.blocker) === lc(blocker))
        .map((b) => b.blocked);
    },
    isBlockedEitherWay(a, b) {
      return state.blocks.some(
        (x) =>
          (lc(x.blocker) === lc(a) && lc(x.blocked) === lc(b)) ||
          (lc(x.blocker) === lc(b) && lc(x.blocked) === lc(a)),
      );
    },

    // Reports --------------------------------------------------------------
    insertReport(r) {
      state.ids.reportId += 1;
      const next: ReportRecord = { ...r, id: state.ids.reportId };
      state.reports.unshift(next);
      flush();
      return next;
    },
    listReports(o = {}) {
      let rows = state.reports.slice();
      if (o.status) rows = rows.filter((r) => r.status === o.status);
      return rows;
    },
    resolveReport(id, by, resolution) {
      const idx = state.reports.findIndex((r) => r.id === id);
      if (idx < 0) return null;
      const next: ReportRecord = {
        ...state.reports[idx],
        status: "resolved",
        resolution,
        resolvedBy: by,
        resolvedAt: Date.now(),
      };
      state.reports[idx] = next;
      flush();
      return next;
    },

    // Stream events --------------------------------------------------------
    insertEvent(e) {
      state.ids.eventId += 1;
      const next: StreamEventRecord = { ...e, id: state.ids.eventId };
      state.events.unshift(next);
      // Cap at 5000 events in MVP to bound memory.
      if (state.events.length > 5000) state.events.length = 5000;
      flush();
      return next;
    },
    insertEventIdempotent(e) {
      // Look up the most recent ~200 events for this email; if any row
      // has the same clientId in metadata, return it. Else insert.
      const cid = e.clientId;
      const ownerLc = e.email.toLowerCase();
      const recent = state.events.slice(0, 500);
      for (const row of recent) {
        if (
          row.email.toLowerCase() === ownerLc &&
          (row.detail as Record<string, unknown> | undefined)?.clientId === cid
        ) {
          return row;
        }
      }
      // Persist clientId in detail so future calls find it.
      const merged: Omit<StreamEventRecord, "id"> = {
        email: e.email,
        kind: e.kind,
        topicId: e.topicId,
        level: e.level,
        detail: { ...(e.detail ?? {}), clientId: cid },
        createdAt: e.createdAt,
      };
      state.ids.eventId += 1;
      const inserted: StreamEventRecord = { ...merged, id: state.ids.eventId };
      state.events.unshift(inserted);
      if (state.events.length > 5000) state.events.length = 5000;
      flush();
      return inserted;
    },
    listEventsSince(sinceMs, limit = 50) {
      return state.events
        .filter((e) => e.createdAt >= sinceMs)
        .slice(0, limit);
    },

    // Telemetry -----------------------------------------------------------
    statsSnapshot() {
      const last24h = Date.now() - 24 * 60 * 60 * 1000;
      const eventsByKind: Record<string, number> = {};
      let events24h = 0;
      for (const e of state.events) {
        eventsByKind[e.kind] = (eventsByKind[e.kind] ?? 0) + 1;
        if (e.createdAt >= last24h) events24h++;
      }
      const signalsByTopic: Record<string, number> = {};
      let kidProfiles = 0;
      let openProfiles = 0;
      let closedProfiles = 0;
      for (const p of state.profiles) {
        if (p.ageBand === "kid") kidProfiles++;
        if (p.profileMode === "open") openProfiles++;
        else closedProfiles++;
        for (const s of p.signals) {
          signalsByTopic[s] = (signalsByTopic[s] ?? 0) + 1;
        }
      }
      const approvedFollows = state.follows.filter((e) => e.status === "approved").length;
      const pendingFollows = state.follows.filter((e) => e.status === "pending").length;
      const openReports = state.reports.filter((r) => r.status === "open").length;
      const resolvedReports = state.reports.filter((r) => r.status === "resolved").length;
      return {
        profileCount: state.profiles.length,
        openProfiles,
        closedProfiles,
        kidProfiles,
        followCount: state.follows.length,
        approvedFollows,
        pendingFollows,
        blockCount: state.blocks.length,
        reportCount: state.reports.length,
        openReports,
        resolvedReports,
        eventCount: state.events.length,
        events24h,
        eventsByKind,
        signalsByTopic,
      };
    },
    backendName() {
      return opts.dbPath ? "memory+jsonfile" : "memory-only";
    },

    // Persistence ----------------------------------------------------------
    flush,
    reset() {
      state.profiles = [];
      state.aggregates = [];
      state.follows = [];
      state.blocks = [];
      state.reports = [];
      state.events = [];
      state.ids = { reportId: 0, eventId: 0 };
      flush();
    },
  };
}
