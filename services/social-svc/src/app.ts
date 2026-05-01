// social-svc — Express app factory. Exported as a function so tests can
// stand up a fresh app per test file with an isolated store.
//
// Auth model (MVP): every endpoint requires an `X-User-Email` header,
// either injected by the auth-verifying proxy (production) or sent
// directly by the SPA in demo mode. The header is treated as the
// authenticated principal — the proxy is the trust boundary.
//
// This is intentionally simple. Tightening (rate limits, scope, full
// session-token verification) lives in the proxy, not here.

import express, { type Request, type Response, type NextFunction } from "express";
import type { Store } from "./store.js";
import {
  baseHandleFromEmail,
  disambiguateHandle,
} from "./handles.js";
import { projectProfile } from "./project.js";
import type {
  PlayerSnapshot,
  ProfileRecord,
  PublicProfile,
  ReportReason,
  StreamCardKind,
} from "./types.js";

interface AppOpts {
  store: Store;
  /**
   * Admin allowlist (lowercased emails). Endpoints under
   * /v1/social/admin require X-User-Email ∈ this set.
   */
  admins?: string[];
  /**
   * If set, every request must carry `Authorization: Bearer ${upstreamKey}`.
   * The auth-verifying proxy sets this; direct callers without the
   * shared secret are rejected with 401. Closes the P0-2 issue from
   * docs/social-mvp-status.md.
   *
   * If unset (e.g. local dev / fork without a proxy), the service runs
   * in trusted-network mode — no bearer required. Operators must
   * either set this OR put the service on a private network.
   */
  upstreamKey?: string;
  /**
   * CORS allowed origins. Comma-separated list, or "*" for any. Default
   * "*". In production set this to your SPA hostname (closes the P1-6
   * issue: combined with upstreamKey, narrows the trust surface).
   */
  allowedOrigins?: string;
}

export function createApp(opts: AppOpts) {
  const app = express();
  const store = opts.store;
  const admins = (opts.admins ?? []).map((s) => s.toLowerCase());
  const upstreamKey = opts.upstreamKey?.trim() || "";
  const allowedOrigins = (opts.allowedOrigins ?? "*")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  app.use(express.json({ limit: "256kb" }));

  // CORS — restricted by allowedOrigins. Default keeps "*" for backward
  // compat with the offline / demo flow; production sets a real origin.
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (allowedOrigins.includes("*")) {
      res.setHeader("access-control-allow-origin", "*");
    } else if (typeof origin === "string" && allowedOrigins.includes(origin)) {
      res.setHeader("access-control-allow-origin", origin);
      res.setHeader("vary", "origin");
    }
    res.setHeader(
      "access-control-allow-methods",
      "GET,POST,PUT,DELETE,OPTIONS",
    );
    res.setHeader(
      "access-control-allow-headers",
      "content-type,authorization,x-user-email",
    );
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });

  // Upstream-bearer enforcement. Runs before requireUser so that direct
  // /curl callers without the shared secret are rejected before the
  // X-User-Email header is even read. Bypassed for /health.
  app.use((req, res, next) => {
    if (req.path === "/health" || req.method === "OPTIONS") return next();
    if (!upstreamKey) return next(); // trusted-network mode
    const auth = req.header("authorization") ?? "";
    const m = auth.match(/^Bearer\s+(.+)$/);
    if (!m || m[1] !== upstreamKey) {
      return res.status(401).json({ error: "missing_upstream_bearer" });
    }
    next();
  });

  // -- Auth -----------------------------------------------------------------
  function requireUser(req: Request, res: Response, next: NextFunction) {
    const email = (req.header("x-user-email") ?? "").trim();
    if (!email) return res.status(401).json({ error: "missing_user" });
    // Read or create the profile lazily on first authenticated request.
    let profile = store.getProfileByEmail(email);
    if (!profile) {
      const base = baseHandleFromEmail(email);
      const handle =
        disambiguateHandle(base, (h) => store.isHandleTaken(h)) ?? `${base}-${Date.now()}`;
      profile = store.upsertProfile({
        email,
        handle,
        displayFirst: handle.charAt(0).toUpperCase() + handle.slice(1),
        ageBand: "adult",
        profileMode: "open",
        showFullName: false,
        showCurrent: true,
        showMap: true,
        showActivity: true,
        showBadges: true,
        showSignup: true,
        signalsGlobal: true,
        signals: [],
        banned: false,
        bannedSocial: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
    if (profile.banned) return res.status(403).json({ error: "banned" });
    (req as Request & { profile: ProfileRecord }).profile = profile;
    next();
  }

  function requireAdmin(req: Request, res: Response, next: NextFunction) {
    const email = (req.header("x-user-email") ?? "").toLowerCase();
    if (!admins.includes(email)) return res.status(403).json({ error: "forbidden" });
    next();
  }

  // -- Health --------------------------------------------------------------
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", version: "0.1.0" });
  });

  // -- /me -----------------------------------------------------------------
  app.get("/v1/social/me", requireUser, (req, res) => {
    const me = (req as Request & { profile: ProfileRecord }).profile;
    const agg = store.getAggregate(me.email);
    res.json(projectProfile(me, agg, me.email));
  });

  app.put("/v1/social/me", requireUser, (req, res) => {
    const me = (req as Request & { profile: ProfileRecord }).profile;
    const patch = req.body ?? {};
    const next: ProfileRecord = { ...me };
    // P0-8 fix: ageBand is now patchable. Once set to "kid", subsequent
    // patches cannot bump it back up — the SPA's onboarding is the
    // single place this is set, and adult ↔ teen ↔ kid is one-way
    // (kid → other is blocked here as a defense in depth).
    if (
      patch.ageBand === "kid" ||
      patch.ageBand === "teen" ||
      patch.ageBand === "adult"
    ) {
      if (me.ageBand === "kid" && patch.ageBand !== "kid") {
        // Don't allow escape from kid mode.
      } else {
        next.ageBand = patch.ageBand;
      }
    }
    // Length-bounded fullName (P2-2 hardening).
    if (typeof patch.fullName === "string") next.fullName = patch.fullName.slice(0, 80);
    if (typeof patch.pictureUrl === "string" && /^https:\/\//.test(patch.pictureUrl)) {
      next.pictureUrl = patch.pictureUrl.slice(0, 1024);
    }
    if (patch.profileMode === "open" || patch.profileMode === "closed") {
      next.profileMode = next.ageBand === "kid" ? "closed" : patch.profileMode;
    }
    for (const k of [
      "showFullName",
      "showCurrent",
      "showMap",
      "showActivity",
      "showBadges",
      "showSignup",
      "signalsGlobal",
    ] as const) {
      if (typeof patch[k] === "boolean") next[k] = patch[k];
    }
    // Kid hard-rules: forced Closed; never on the Global Leaderboard.
    if (next.ageBand === "kid") {
      next.profileMode = "closed";
      next.signalsGlobal = false;
    }
    const saved = store.upsertProfile(next);
    const agg = store.getAggregate(me.email);
    res.json(projectProfile(saved, agg, saved.email));
  });

  app.put("/v1/social/me/signals", requireUser, (req, res) => {
    const me = (req as Request & { profile: ProfileRecord }).profile;
    const topics = Array.isArray(req.body?.topics)
      ? (req.body.topics as string[]).filter(Boolean)
      : [];
    const capped = Array.from(new Set(topics)).slice(0, 5);
    const saved = store.upsertProfile({ ...me, signals: capped });
    res.json({ topics: saved.signals });
  });

  app.post("/v1/social/me/snapshot", requireUser, (req, res) => {
    const me = (req as Request & { profile: ProfileRecord }).profile;
    const snap = req.body as Partial<PlayerSnapshot> | undefined;

    // P0-6 fix: validate the snapshot shape rather than hitting an
    // uncaught TypeError on missing fields.
    if (
      !snap ||
      typeof snap !== "object" ||
      typeof snap.xpTotal !== "number" ||
      typeof snap.streak !== "number" ||
      typeof snap.guildTier !== "string" ||
      !snap.clientWindow ||
      typeof snap.clientWindow.to !== "number"
    ) {
      return res.status(400).json({ error: "invalid_snapshot" });
    }

    // P1-3 hardening: bound the obviously-impossible inputs. Real
    // production tightening lives in Sprint 2.5.
    if (snap.xpTotal > 1e9 || snap.xpTotal < 0) {
      return res.status(400).json({ error: "xp_out_of_range" });
    }
    if (snap.streak > 10000 || snap.streak < 0) {
      return res.status(400).json({ error: "streak_out_of_range" });
    }
    if (snap.currentLevel != null && (snap.currentLevel < 0 || snap.currentLevel > 100)) {
      return res.status(400).json({ error: "level_out_of_range" });
    }

    // Plausibility: xp must not regress more than 10%.
    const prev = store.getAggregate(me.email);
    if (prev && snap.xpTotal < prev.xpTotal * 0.9) {
      return res.status(409).json({ error: "implausible_xp" });
    }
    store.upsertAggregate({
      email: me.email,
      xpTotal: snap.xpTotal,
      xpWeek: snap.xpWeek ?? 0,
      xpMonth: snap.xpMonth ?? 0,
      streak: snap.streak,
      guildTier: snap.guildTier as "Builder" | "Architect" | "Visionary" | "Founder" | "Singularity",
      currentTopicId: snap.currentTopicId,
      currentLevel: snap.currentLevel,
      badges: Array.isArray(snap.badges) ? snap.badges : [],
      topicXp: typeof snap.topicXp === "object" && snap.topicXp ? snap.topicXp : {},
      activity14d: Array.isArray(snap.activity14d) ? snap.activity14d.slice(0, 14) : [],
      lastEventAt: snap.clientWindow.to,
      updatedAt: Date.now(),
    });
    // P0-5 fix: events are inserted via insertEventIdempotent so the
    // same clientId can't multiply rows on retry / StrictMode.
    // P1-3 hardening: validate `kind` against the allowed set.
    const allowedKinds = new Set<StreamCardKind>([
      "level_up",
      "boss_beaten",
      "streak_milestone",
      "spotlight",
    ]);
    const events = Array.isArray(snap.events) ? snap.events.slice(0, 50) : [];
    const nowMs = Date.now();
    for (const ev of events) {
      if (!ev || typeof ev !== "object") continue;
      const kind = ev.kind as StreamCardKind;
      if (!allowedKinds.has(kind)) continue;
      const cid = typeof ev.clientId === "string" ? ev.clientId : `${me.email}|${kind}|${ev.topicId ?? ""}|${ev.level ?? ""}|${snap.clientWindow.to}`;
      store.insertEventIdempotent({
        email: me.email,
        kind,
        topicId: typeof ev.topicId === "string" ? ev.topicId : undefined,
        level: typeof ev.level === "number" ? ev.level : undefined,
        detail: typeof ev.detail === "object" && ev.detail ? ev.detail : undefined,
        // Reject future-dated clientWindow.to.
        createdAt: Math.min(snap.clientWindow.to, nowMs),
        clientId: cid,
      });
    }
    res.status(204).end();
  });

  // -- Profiles ------------------------------------------------------------
  app.get("/v1/social/profiles/:handle", requireUser, (req, res) => {
    const me = (req as Request & { profile: ProfileRecord }).profile;
    const target = store.getProfileByHandle(String(req.params.handle));
    if (!target || target.banned) return res.status(404).json({ error: "not_found" });
    if (store.isBlockedEitherWay(me.email, target.email)) {
      return res.status(404).json({ error: "not_found" });
    }
    // Closed-mode: only self and approved followers see the full payload.
    if (target.profileMode === "closed" && me.email !== target.email) {
      const edge = store.getFollow(me.email, target.email);
      if (!edge || edge.status !== "approved") {
        // P1-5 fix: closed-mode stub no longer leaks email, pictureUrl,
        // or ageBandIsKid. Visitors see only the bare minimum needed
        // to render the gate card: handle, a generic display name, and
        // the closed-mode flag. The age-band hint is revealed only
        // after `approved` via the full projectProfile payload.
        return res.json({
          email: "",
          handle: target.handle,
          displayName: target.handle.charAt(0).toUpperCase() + target.handle.slice(1),
          pictureUrl: undefined,
          guildTier: "Builder",
          streak: 0,
          xpTotal: 0,
          signals: [],
          badges: [],
          ageBandIsKid: false,
          profileMode: "closed" as const,
          signupAt: 0,
        } satisfies PublicProfile);
      }
    }
    const agg = store.getAggregate(target.email);
    res.json(projectProfile(target, agg, me.email));
  });

  // -- Follow graph --------------------------------------------------------
  app.post("/v1/social/follow/:handle", requireUser, (req, res) => {
    const me = (req as Request & { profile: ProfileRecord }).profile;
    const target = store.getProfileByHandle(String(req.params.handle));
    if (!target || target.banned) return res.status(404).json({ error: "not_found" });
    if (target.email.toLowerCase() === me.email.toLowerCase()) {
      return res.status(409).json({ error: "self_follow" });
    }
    if (store.isBlockedEitherWay(me.email, target.email)) {
      return res.status(403).json({ error: "blocked" });
    }
    const existing = store.getFollow(me.email, target.email);
    if (existing) return res.json(existing);
    const edge = store.upsertFollow({
      follower: me.email,
      target: target.email,
      status: target.profileMode === "closed" ? "pending" : "approved",
      muted: false,
      createdAt: Date.now(),
      approvedAt: target.profileMode === "open" ? Date.now() : undefined,
    });
    res.status(201).json(edge);
  });

  app.delete("/v1/social/follow/:handle", requireUser, (req, res) => {
    const me = (req as Request & { profile: ProfileRecord }).profile;
    const target = store.getProfileByHandle(String(req.params.handle));
    if (!target) return res.status(404).json({ error: "not_found" });
    store.removeFollow(me.email, target.email);
    res.status(204).end();
  });

  app.put("/v1/social/follow/:handle/mute", requireUser, (req, res) => {
    const me = (req as Request & { profile: ProfileRecord }).profile;
    const target = store.getProfileByHandle(String(req.params.handle));
    if (!target) return res.status(404).json({ error: "not_found" });
    const existing = store.getFollow(me.email, target.email);
    if (!existing) return res.status(404).json({ error: "not_following" });
    const muted = !!req.body?.muted;
    store.upsertFollow({ ...existing, muted });
    res.status(204).end();
  });

  app.post("/v1/social/requests/:followerEmail/approve", requireUser, (req, res) => {
    const me = (req as Request & { profile: ProfileRecord }).profile;
    const edge = store.getFollow(String(req.params.followerEmail), me.email);
    if (!edge) return res.status(404).json({ error: "not_found" });
    store.upsertFollow({ ...edge, status: "approved", approvedAt: Date.now() });
    res.status(204).end();
  });

  app.post("/v1/social/requests/:followerEmail/decline", requireUser, (req, res) => {
    const me = (req as Request & { profile: ProfileRecord }).profile;
    const edge = store.getFollow(String(req.params.followerEmail), me.email);
    if (edge && edge.status === "pending") store.removeFollow(edge.follower, edge.target);
    res.status(204).end();
  });

  app.delete("/v1/social/requests/outgoing/:targetHandle", requireUser, (req, res) => {
    const me = (req as Request & { profile: ProfileRecord }).profile;
    const target = store.getProfileByHandle(String(req.params.targetHandle));
    if (!target) return res.status(404).json({ error: "not_found" });
    const edge = store.getFollow(me.email, target.email);
    if (edge && edge.status === "pending") store.removeFollow(edge.follower, edge.target);
    res.status(204).end();
  });

  app.get("/v1/social/me/following", requireUser, (req, res) => {
    const me = (req as Request & { profile: ProfileRecord }).profile;
    const status = req.query.status as "approved" | "pending" | undefined;
    const all = store.listFollowing(me.email);
    res.json(status ? all.filter((e) => e.status === status) : all);
  });

  app.get("/v1/social/me/followers", requireUser, (req, res) => {
    const me = (req as Request & { profile: ProfileRecord }).profile;
    const status = req.query.status as "approved" | "pending" | undefined;
    const all = store.listFollowers(me.email);
    res.json(status ? all.filter((e) => e.status === status) : all);
  });

  // -- Blocks --------------------------------------------------------------
  app.post("/v1/social/blocks/:handle", requireUser, (req, res) => {
    const me = (req as Request & { profile: ProfileRecord }).profile;
    const target = store.getProfileByHandle(String(req.params.handle));
    if (!target) return res.status(404).json({ error: "not_found" });
    if (target.email.toLowerCase() === me.email.toLowerCase()) {
      return res.status(409).json({ error: "self_block" });
    }
    store.addBlock(me.email, target.email);
    res.status(204).end();
  });

  app.delete("/v1/social/blocks/:targetEmail", requireUser, (req, res) => {
    const me = (req as Request & { profile: ProfileRecord }).profile;
    store.removeBlock(me.email, String(req.params.targetEmail));
    res.status(204).end();
  });

  app.get("/v1/social/me/blocked", requireUser, (req, res) => {
    const me = (req as Request & { profile: ProfileRecord }).profile;
    res.json(store.listBlocked(me.email));
  });

  // -- Reports -------------------------------------------------------------
  app.post("/v1/social/reports", requireUser, (req, res) => {
    const me = (req as Request & { profile: ProfileRecord }).profile;
    const { targetHandle, reason, note, context } = req.body ?? {};
    const target = store.getProfileByHandle(targetHandle ?? "");
    if (!target) return res.status(404).json({ error: "not_found" });
    if (
      !["spam", "harassment", "off-topic", "impersonation", "other"].includes(reason)
    ) {
      return res.status(400).json({ error: "invalid_reason" });
    }
    store.insertReport({
      reporter: me.email,
      reported: target.email,
      reason: reason as ReportReason,
      note: typeof note === "string" ? note.slice(0, 280) : undefined,
      context: typeof context === "object" ? context : undefined,
      status: "open",
      createdAt: Date.now(),
    });
    // Auto-mute the reported account from the reporter's feed.
    const edge = store.getFollow(me.email, target.email);
    if (edge) store.upsertFollow({ ...edge, muted: true });
    res.status(204).end();
  });

  // -- Boards (placeholder; full ranking lands in a follow-up) -------------
  app.get("/v1/social/boards/:scope", requireUser, (_req, res) => {
    // MVP: empty array. The SPA's mock filler keeps screens alive.
    res.json([]);
  });

  // -- Stream --------------------------------------------------------------
  app.get("/v1/social/stream", requireUser, (req, res) => {
    const me = (req as Request & { profile: ProfileRecord }).profile;
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? "50"), 10) || 50));
    const since = Date.now() - 14 * 24 * 60 * 60 * 1000;

    const myFollows = new Set(
      store
        .listFollowing(me.email)
        .filter((e) => e.status === "approved" && !e.muted)
        .map((e) => e.target.toLowerCase()),
    );
    const blocked = new Set(store.listBlocked(me.email).map((s) => s.toLowerCase()));

    const cards = store
      .listEventsSince(since, 200)
      .filter((e) => {
        if (e.email.toLowerCase() === me.email.toLowerCase()) return false;
        if (blocked.has(e.email.toLowerCase())) return false;
        return myFollows.has(e.email.toLowerCase());
      })
      .slice(0, limit)
      .map((e) => {
        const author = store.getProfileByEmail(e.email);
        if (!author) return null;
        return {
          id: `e-${e.id}`,
          authorHandle: author.handle,
          authorDisplay: author.fullName?.split(/\s+/)[0] ?? author.displayFirst,
          authorPicture: author.pictureUrl,
          authorTier: store.getAggregate(author.email)?.guildTier ?? "Builder",
          topicId: e.topicId,
          topicName: e.topicId,
          level: e.level,
          kind: e.kind,
          detail: e.detail,
          createdAt: e.createdAt,
          iAmFollowing: true,
          iCanFollow: false,
        };
      })
      .filter(Boolean);
    res.json(cards);
  });

  // -- Admin: moderation queue --------------------------------------------
  app.get("/v1/social/admin/reports", requireUser, requireAdmin, (req, res) => {
    const status = (req.query.status as "open" | "resolved" | "dismissed" | undefined) ?? "open";
    res.json(store.listReports({ status }));
  });

  app.post("/v1/social/admin/reports/:id/resolve", requireUser, requireAdmin, (req, res) => {
    const me = (req as Request & { profile: ProfileRecord }).profile;
    const id = parseInt(String(req.params.id), 10);
    const resolution = String(req.body?.resolution ?? "no-action");
    const next = store.resolveReport(id, me.email, resolution);
    if (!next) return res.status(404).json({ error: "not_found" });
    res.json(next);
  });

  return app;
}
