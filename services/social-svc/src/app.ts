// social-svc — Express app factory.
//
// Auth model (production): the SPA sends the mem0-issued session JWT
// (HS256, signed with JWT_SECRET) in the `Authorization: Bearer ...`
// header. The sidecar verifies it locally — same secret as mem0 — and
// extracts the email claim. No round-trip, no separate proxy, no
// bearer-in-browser issue (the JWT is short-lived and scoped).
//
// Demo / fork mode: when `demoTrustHeader` is true (set via env
// SOCIAL_DEMO_TRUST_HEADER=1), the sidecar accepts `X-User-Email`
// directly, no JWT. Refused at module load when NODE_ENV=production.
//
// This file is the only http-facing module. Logging is structured
// JSON via ./log.ts; rate limits via ./rate-limit.ts; JWT verify via
// ./verify.ts.

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
import { log, emailHash } from "./log.js";
import { verifySessionJwt } from "./verify.js";
import { DEFAULT_RULES, inMemoryBucket, type RateBucket, type RateRule } from "./rate-limit.js";
import { sendEmail, smtpStatus } from "./email.js";

interface AppOpts {
  store: Store;
  /** Admin allowlist (lowercased emails). */
  admins?: string[];
  /**
   * HMAC secret for session-JWT verification. Same value as mem0's
   * JWT_SECRET. When empty, JWT auth is disabled and only the demo
   * header path is open (intended only for local-dev / fork mode).
   */
  jwtSecret?: string;
  /**
   * CORS allowed origins. Comma-separated, or "*" for any.
   * Defaults to "*" — same-origin deployments don't trigger CORS at all,
   * so this only matters when the SPA and sidecar are on different
   * hostnames (fork / dev setups).
   */
  allowedOrigins?: string;
  /**
   * When true, accept `X-User-Email` directly (no JWT). For local dev
   * and forks. The constructor refuses this with NODE_ENV=production.
   */
  demoTrustHeader?: boolean;
  /** Optional rate-limit bucket. Defaults to in-memory. */
  rateBucket?: RateBucket;
}

export function createApp(opts: AppOpts) {
  if (opts.demoTrustHeader && process.env.NODE_ENV === "production") {
    throw new Error(
      "demoTrustHeader=true is refused under NODE_ENV=production — would let any caller impersonate any user.",
    );
  }
  const app = express();
  const store = opts.store;
  const admins = (opts.admins ?? []).map((s) => s.toLowerCase());
  const jwtSecret = opts.jwtSecret?.trim() || "";
  const demoTrustHeader = !!opts.demoTrustHeader;
  const allowedOrigins = (opts.allowedOrigins ?? "*")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const rateBucket = opts.rateBucket ?? inMemoryBucket();

  if (!jwtSecret && !demoTrustHeader) {
    log.warn(
      "no jwtSecret and demoTrustHeader=false — every request will 401. Set JWT_SECRET (production) or SOCIAL_DEMO_TRUST_HEADER=1 (dev).",
    );
  }

  // Behind nginx in production. Trust the immediate proxy so req.ip
  // reflects the real client (used by the visit-tracking rate limiter).
  // Setting "loopback" rather than `true` avoids accepting forged
  // X-Forwarded-For headers from non-loopback origins.
  app.set("trust proxy", "loopback");

  app.use(express.json({ limit: "256kb" }));

  // -- Per-request log line + req_id ---------------------------------------
  app.use((req, res, next) => {
    const start = Date.now();
    const reqId = `r-${start.toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    (req as Request & { _reqId: string })._reqId = reqId;
    res.setHeader("x-req-id", reqId);
    res.on("finish", () => {
      const ms = Date.now() - start;
      const email = (req as Request & { profile?: ProfileRecord }).profile?.email;
      log.info("req", {
        req_id: reqId,
        method: req.method,
        route: req.path,
        status: res.statusCode,
        ms,
        email_hash: emailHash(email),
      });
    });
    next();
  });

  // -- CORS -----------------------------------------------------------------
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

  // -- Auth: verify session JWT, derive email --------------------------------
  async function authenticate(req: Request): Promise<string | null> {
    const auth = req.header("authorization") ?? "";
    const m = auth.match(/^Bearer\s+(.+)$/);
    if (m && jwtSecret) {
      try {
        const claims = await verifySessionJwt(m[1]!, { secret: jwtSecret });
        if (typeof claims.email === "string" && claims.email) {
          return claims.email.trim().toLowerCase();
        }
      } catch (e) {
        log.warn("jwt_verify_failed", {
          req_id: (req as Request & { _reqId: string })._reqId,
          err: (e as Error).message,
        });
        return null;
      }
    }
    // Demo / fork fallback: trust X-User-Email directly. Refused in prod
    // by the constructor guard above.
    if (demoTrustHeader) {
      const demo = (req.header("x-user-email") ?? "").trim();
      if (demo && demo.includes("@")) return demo.toLowerCase();
    }
    return null;
  }

  // -- requireUser: rate-limit + auth + lazy-create profile -----------------
  async function requireUser(req: Request, res: Response, next: NextFunction) {
    const email = await authenticate(req);
    if (!email) return res.status(401).json({ error: "unauthenticated" });

    // Rate limit BEFORE creating the profile so spammers can't fill the store.
    const rule = pickRateRule(req);
    const limited = rateBucket.hit(email, rule);
    if (!limited.ok) {
      res.setHeader("retry-after", String(limited.retryAfter ?? 60));
      log.warn("rate_limited", {
        req_id: (req as Request & { _reqId: string })._reqId,
        email_hash: emailHash(email),
        action: rule.action,
        reason: limited.reason,
      });
      return res.status(429).json({ error: "rate_limited", reason: limited.reason });
    }

    // Lazy profile creation on first authenticated request.
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
      log.info("profile_created", {
        req_id: (req as Request & { _reqId: string })._reqId,
        email_hash: emailHash(email),
        handle,
      });
    }
    if (profile.banned) {
      log.warn("banned_request", { email_hash: emailHash(email) });
      return res.status(403).json({ error: "banned" });
    }
    (req as Request & { profile: ProfileRecord }).profile = profile;
    next();
  }

  function pickRateRule(req: Request): RateRule {
    const p = req.path;
    const m = req.method;
    if (m === "POST" && p === "/v1/social/me/snapshot") return DEFAULT_RULES.social_snapshot;
    if (m === "POST" && p === "/v1/social/reports") return DEFAULT_RULES.social_report;
    if (m === "GET") return DEFAULT_RULES.social_read;
    return DEFAULT_RULES.social_write;
  }

  function requireAdmin(req: Request, res: Response, next: NextFunction) {
    // requireUser must run first — req.profile is set by it.
    const profile = (req as Request & { profile?: ProfileRecord }).profile;
    if (!profile || !admins.includes(profile.email.toLowerCase())) {
      return res.status(403).json({ error: "forbidden" });
    }
    next();
  }

  // -- Health --------------------------------------------------------------
  // Returns startup-state so cloud-claude / operators can detect
  // misconfiguration before users see 401s in the wild.
  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      version: "0.1.0",
      jwt_configured: !!jwtSecret,
      demo_trust_header: demoTrustHeader,
      admins: admins.length,
      backend: opts.store.backendName?.() ?? "memory",
      // Booleans below are surfaced so monitoring can alert on them.
      // demo_trust_header should NEVER be true in production; if it is,
      // someone enabled the impersonation footgun.
      misconfig: !jwtSecret && !demoTrustHeader,
    });
  });

  // -- Visit tracking ------------------------------------------------------
  // Anonymous traffic beacon. Open (no auth) — first-time visitors aren't
  // signed in yet, and source-attribution is the whole point of this
  // endpoint. Stores ONLY:
  //   - pathname (no full URL, so query params can't leak)
  //   - normalized referrer domain (or "(direct)" / "(internal)")
  //   - utm_source / ref / from query param (lowercased)
  // No IP, no UA, no email. The point of capturing this is for the admin
  // operator to see "did the LinkedIn post bring 12 visits?" in the
  // Traffic dashboard — nothing else.
  //
  // Rate-limited per source IP via a synthetic action key so the bucket
  // can't be wedged by hostile callers. The cap is generous because real
  // browsers fire at most one beacon per session.
  app.post("/v1/social/track/visit", express.json({ limit: "2kb" }), (req, res) => {
    const ip = (req.ip || req.socket?.remoteAddress || "unknown").toString();
    const rule: RateRule = { action: "track_visit", perMinute: 30, perHour: 200 };
    const r = rateBucket.hit(`ip:${ip}`, rule);
    if (!r.ok) {
      // Best-effort silence — don't reveal limits to scrapers, just 204
      // so the SPA's beacon resolves successfully.
      return res.status(204).end();
    }
    const body = req.body ?? {};
    const path = typeof body.path === "string" ? body.path.slice(0, 200) : "/";
    const refDomain =
      typeof body.refDomain === "string" && body.refDomain.length > 0
        ? body.refDomain.toLowerCase().slice(0, 200)
        : "(direct)";
    const source =
      typeof body.source === "string" && body.source.length > 0
        ? body.source.toLowerCase().trim().slice(0, 80)
        : null;
    store.recordVisit({ path, refDomain, source });
    return res.status(204).end();
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
  // Per PRD §4.5 the Stream is a blend of three visibility paths:
  //   1. Approved follows (you actively follow this author)
  //   2. Signal overlap (you both have ≥1 Topic Signal in common AND
  //      the author has profileMode=open)
  //   3. Spotlight (server-emitted top-mover cards for Topics in your
  //      Signals — produced by the spotlight cron in index.ts)
  // Filtered by: blocked-either-way, banned, banned_social, kid-vs-adult,
  // muted authors, and self.
  app.get("/v1/social/stream", requireUser, (req, res) => {
    const me = (req as Request & { profile: ProfileRecord }).profile;
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? "50"), 10) || 50));
    const since = Date.now() - 14 * 24 * 60 * 60 * 1000;

    const myFollowEdges = store.listFollowing(me.email);
    const myFollowsApproved = new Set(
      myFollowEdges
        .filter((e) => e.status === "approved" && !e.muted)
        .map((e) => e.target.toLowerCase()),
    );
    const mutedAuthors = new Set(
      myFollowEdges.filter((e) => e.muted).map((e) => e.target.toLowerCase()),
    );
    const blocked = new Set(store.listBlocked(me.email).map((s) => s.toLowerCase()));
    const mySignals = new Set(me.signals);
    const meIsKid = me.ageBand === "kid";

    const cards = store
      .listEventsSince(since, 500)
      .filter((e) => {
        const lc = e.email.toLowerCase();
        if (lc === me.email.toLowerCase()) return false;
        if (blocked.has(lc)) return false;
        if (mutedAuthors.has(lc)) return false;
        const author = store.getProfileByEmail(e.email);
        if (!author || author.banned || author.bannedSocial) return false;
        // Kid isolation: adult viewers never see kid authors; kid viewers
        // never see adult authors. Symmetric.
        if (meIsKid !== (author.ageBand === "kid")) return false;
        // Visibility paths:
        if (myFollowsApproved.has(lc)) return true;
        if (e.kind === "spotlight" && e.topicId && mySignals.has(e.topicId)) return true;
        // Signal overlap (Open profiles only).
        if (
          author.profileMode === "open" &&
          author.signals.some((s) => mySignals.has(s))
        ) return true;
        return false;
      })
      .slice(0, limit)
      .map((e) => {
        const author = store.getProfileByEmail(e.email);
        if (!author) return null;
        const lc = e.email.toLowerCase();
        const iAmFollowing = myFollowsApproved.has(lc);
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
          iAmFollowing,
          iCanFollow: !iAmFollowing && author.profileMode === "open",
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

  // -- Email --------------------------------------------------------------
  // Server-side SMTP send. The SPA's Admin → Emails tab POSTs the
  // already-rendered subject + HTML body here; the sidecar uses
  // nodemailer to send via the SMTP env vars (host, user, password,
  // from). Admin-only — only emails in SOCIAL_ADMIN_EMAILS can hit
  // this endpoint, so it can't be used as an open relay even if a
  // session JWT is leaked.
  app.get("/v1/email/status", requireUser, requireAdmin, (_req, res) => {
    res.json(smtpStatus());
  });

  app.post("/v1/email/send", requireUser, requireAdmin, async (req, res) => {
    const me = (req as Request & { profile: ProfileRecord }).profile;
    const { to, subject, html, text, fromName, replyTo, unsubscribeUrl } = req.body ?? {};
    if (typeof to !== "string" || !to.includes("@")) {
      return res.status(400).json({ error: "invalid_to" });
    }
    if (typeof subject !== "string" || !subject.length) {
      return res.status(400).json({ error: "invalid_subject" });
    }
    if (typeof html !== "string" || !html.length) {
      return res.status(400).json({ error: "invalid_html" });
    }
    if (
      typeof unsubscribeUrl === "string" &&
      unsubscribeUrl.length > 0 &&
      !/^https:\/\//i.test(unsubscribeUrl)
    ) {
      // Reject non-HTTPS up front so callers don't think they got a
      // working one-click button while RFC 8058 silently disabled it.
      return res.status(400).json({ error: "unsubscribe_url_must_be_https" });
    }
    log.info("email_attempt", {
      sent_by_hash: emailHash(me.email),
      to_domain: to.split("@")[1] ?? "?",
    });
    const r = await sendEmail({
      to,
      subject,
      html,
      text: typeof text === "string" ? text : undefined,
      fromName: typeof fromName === "string" ? fromName : undefined,
      replyTo: typeof replyTo === "string" ? replyTo : undefined,
      unsubscribeUrl:
        typeof unsubscribeUrl === "string" && unsubscribeUrl.length > 0
          ? unsubscribeUrl
          : undefined,
    });
    if (!r.ok) return res.status(503).json({ error: "send_failed", reason: r.reason });
    res.json({ ok: true, messageId: r.messageId });
  });

  // -- Admin: telemetry ----------------------------------------------------
  // One JSON blob the AdminAnalytics social panel polls. Cheap to compute
  // since the in-memory store walks once. Postgres adapter provides the
  // same shape via SQL aggregates.
  app.get("/v1/social/admin/analytics", requireUser, requireAdmin, (_req, res) => {
    const stats = store.statsSnapshot();
    const traffic = store.trafficSnapshot();
    res.json({
      ...stats,
      traffic,
      generatedAt: Date.now(),
    });
  });

  return app;
}
