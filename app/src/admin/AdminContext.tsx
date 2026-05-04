import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from "react";
import type { AdminConfig, EmailTemplate, EmailTemplateId, MockUser } from "./types";
import {
  ADMIN_STORAGE_KEY,
  isAdmin,
  loadAdminConfig,
  queueEmail,
  saveAdminConfig,
} from "./store";
import { defaultAdminConfig } from "./defaults";
import { buildAnalytics, buildMockUsers } from "./mockUsers";
import { sendEmail } from "./sender";
import {
  TRANSACTIONAL_TEMPLATES,
  applyPlanToQueue,
  callPrepareSend,
  injectEmailExtras,
  planEmailFlush,
  type RecipientPolicyState,
} from "./emailPolicy";
import { usePlayer } from "../store/PlayerContext";
import { tierForXP } from "../store/game";

/** Real signed-up user as returned by mem0's `/v1/state/admin/users`.
 *  user_state is the canonical "who has signed in" table — every Google
 *  sign-in that mutates SPA state writes a row via PUT /v1/state.
 *  Older mem0 builds returned only `email`/`updated_at`/`xp`/`streak`;
 *  the optional fields below are populated by mem0#14 onwards. */
interface RealUserSummary {
  email: string;
  /** ISO timestamps from the Postgres row. */
  created_at?: string | null;
  updated_at: string | null;
  /** Epoch ms derived from the opaque blob. Both may be null when the
   *  blob is empty (very fresh user) or missing those keys. */
  signup_at?: number | null;
  last_seen_at?: number | null;
  xp: number;
  streak: number;
  total_sparks?: number;
  total_minutes?: number;
  /** 14 ints, sparks/day, oldest-first. Mirrors the SPA's own
   *  computeActivity14d so admin charts agree with player Dashboard. */
  activity_14d?: number[];
  /** Email policy state (added by mem0#15 onwards). All optional —
   *  flushQueue's policy engine treats missing values as "no
   *  unsubscribe / no pause / no recent log". */
  email_unsubscribed_at?: number | null;
  email_pause_until?: number | null;
  email_log?: Array<{
    id?: string;
    tpl?: string;
    sent_at?: number | null;
    opened_at?: number | null;
    is_transactional?: boolean;
  }>;
}
interface RealUsersResponse {
  count: number;
  recent: RealUserSummary[];
}

type Action =
  | { type: "init"; cfg: AdminConfig }
  | { type: "set"; mutate: (cfg: AdminConfig) => AdminConfig };

function reducer(state: AdminConfig, action: Action): AdminConfig {
  switch (action.type) {
    case "init":
      return action.cfg;
    case "set":
      return action.mutate(state);
  }
}

interface Ctx {
  config: AdminConfig;
  isAdmin: boolean;
  mockUsers: MockUser[];
  /**
   * Authoritative count of real signed-up users from mem0's `user_state`,
   * or `null` when the endpoint isn't reachable (no session JWT, no
   * mem0Url, non-admin caller, network error). Surfaced separately from
   * `mockUsers.length` so the Analytics banner can distinguish "we have
   * real numbers" from "we're falling back to local". Doesn't affect the
   * social/memory pipelines — those live in their own contexts.
   */
  realUserCount: number | null;
  realUsersError: string | null;
  /**
   * Server-side wipe of a real user's user_state row on mem0. Resolves
   * `true` when the row was wiped, `false` when the user wasn't in
   * mem0 (id wasn't a `mem0:*` real user). Refetches the real-users
   * list on success so the UI stays consistent. Throws on network /
   * permission errors so callers can surface them.
   *
   * The local `resetUserProgress` is intentionally kept for the
   * mock-cohort rows — calling it on a real user would silently
   * rebound on the next refetch.
   */
  wipeRealUserState: (id: string) => Promise<boolean>;
  /**
   * Permanent removal: cascades the delete across mem0 (user_state,
   * memories, auth.users) AND social-svc (profile + follow/block/event
   * cascade) via mem0's `/v1/state/admin/users/{email}/cascade` route.
   * Returns `{ ok: true, steps }` on success — `steps` is mem0's
   * structured per-store report (rendered in the admin row's toast).
   *
   * Distinct from `wipeRealUserState` (= reset-progress only). On the
   * removed user's next sign-in, fresh onboarding kicks in.
   */
  cascadeRemoveRealUser: (id: string) => Promise<{ ok: boolean; steps?: string }>;
  setConfig: (mutate: (cfg: AdminConfig) => AdminConfig) => void;
  bootstrapAdmin: (email: string) => void;
  addAdmin: (email: string) => boolean;
  removeAdmin: (email: string) => void;
  updateTemplate: (tpl: EmailTemplate) => void;
  toggleTemplate: (id: EmailTemplateId, enabled: boolean) => void;
  banUser: (id: string, banned: boolean) => void;
  resetUserProgress: (id: string) => void;
  sendTemplateToUser: (
    userId: string,
    templateId: EmailTemplateId,
    extraVars?: Record<string, string | number>
  ) => void;
  flushQueue: () => Promise<void> | void;
  sendTestEmail: (to: string, templateId: EmailTemplateId) => Promise<{ ok: boolean; error?: string }>;
  resetAdminConfig: () => void;
}

const AdminCtx = createContext<Ctx | null>(null);

export function AdminProvider({ children }: { children: ReactNode }) {
  const { state: player } = usePlayer();
  const [config, dispatch] = useReducer(reducer, defaultAdminConfig());
  const [mockUsers, setMockUsers] = useState<MockUser[]>([]);
  const [realUsers, setRealUsers] = useState<RealUsersResponse | null>(null);
  const [realUsersError, setRealUsersError] = useState<string | null>(null);
  // Bumped to force a refetch of /v1/state/admin/users — used after
  // wipeRealUserState so the table updates without a full page reload.
  const [realUsersRefreshKey, setRealUsersRefreshKey] = useState(0);
  // Mirror of PlayerContext's hydration flag. Without this, the first
  // mount runs the persist effect with the still-default config and
  // clobbers the saved admin config (mem0 server URL, API keys,
  // branding, allowlist, …) before the hydrate dispatch is processed.
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    dispatch({ type: "init", cfg: loadAdminConfig() });
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveAdminConfig(config);
  }, [config, hydrated]);

  // Pull the authoritative real-user list from mem0's `user_state` when
  // there's a session JWT + a configured mem0Url. Admin-only on the
  // server (admin_api_key OR session JWT with `is_admin=true`); 401/403
  // surface in `realUsersError` and the merged-cohort effect below
  // falls back to "self only" behavior. Lives here (not in
  // AdminAnalytics) so every consumer of `mockUsers` — Users table,
  // Analytics, future per-user actions — sees the same source of truth.
  // Memory and social contexts are intentionally untouched: they read
  // their own per-user endpoints and never consume `mockUsers`.
  useEffect(() => {
    const token = player.serverSession?.token;
    const base = config.serverAuth.mem0Url;
    if (!token || !base) {
      setRealUsers(null);
      setRealUsersError(null);
      return;
    }
    let cancelled = false;
    fetch(`${base}/v1/state/admin/users?limit=200`, {
      headers: { authorization: `Bearer ${token}` },
    })
      .then(async (r) => {
        if (r.status === 403) throw new Error("not_admin");
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (!cancelled) {
          setRealUsers(data as RealUsersResponse);
          setRealUsersError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setRealUsers(null);
          setRealUsersError((e as Error).message);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [config.serverAuth.mem0Url, player.serverSession?.token, realUsersRefreshKey]);

  // Build the cohort displayed across Users / Analytics / etc.:
  // 1. Demo cohort (~30 fake rows) only when `flags.showDemoData` is on.
  // 2. Real signed-up users from mem0 (if reachable).
  // 3. Current signed-in player (always, when identity is present).
  // Self is deduped against (2) by email so the admin doesn't appear twice.
  // The current player's row carries the live local progress (xp, history)
  // — that's fresher than the snapshot mem0 has, since /v1/state writes
  // are debounced ~1s.
  useEffect(() => {
    const base = config.flags.showDemoData ? buildMockUsers() : [];
    const merged: MockUser[] = base.slice();
    const selfEmail = player.identity?.email?.toLowerCase();
    const selfMatched = !!selfEmail && !!realUsers?.recent.some(
      (u) => u.email.toLowerCase() === selfEmail
    );

    if (realUsers) {
      for (const u of realUsers.recent) {
        const isSelf = !!selfEmail && u.email.toLowerCase() === selfEmail;
        // The current admin's row always sources from local PlayerState
        // (added below) so we skip the mem0 copy here to avoid a stale
        // double.
        if (isSelf) continue;
        // Prefer the richer fields exposed by mem0#14 onwards. Fall back
        // to row timestamps + xp-derived approximations when the older
        // shape is in flight (helps during a deploy where front and back
        // are momentarily out of sync).
        const updatedMs = u.updated_at ? Date.parse(u.updated_at) : Date.now();
        const createdMs = u.created_at ? Date.parse(u.created_at) : updatedMs;
        const signupAt = u.signup_at ?? createdMs;
        const lastSeenAt = u.last_seen_at ?? updatedMs;
        const totalSparks =
          typeof u.total_sparks === "number" ? u.total_sparks : Math.max(1, Math.floor(u.xp / 10));
        const totalMinutes =
          typeof u.total_minutes === "number" ? u.total_minutes : Math.max(1, Math.floor(u.xp / 8));
        const activity = Array.isArray(u.activity_14d) ? u.activity_14d : [];
        const daysActive = activity.length
          ? activity.filter((n) => n > 0).length
          : Math.max(1, Math.min(30, Math.floor(u.xp / 30)));
        merged.unshift({
          id: `mem0:${u.email}`,
          email: u.email,
          name: u.email.split("@")[0],
          ageBand: "adult",
          skillLevel: "builder",
          signupAt,
          lastSeenAt,
          xp: u.xp,
          streak: u.streak,
          tier: tierForXP(u.xp),
          daysActive,
          totalSparks,
          totalMinutes,
          banned: false,
        });
      }
    }

    if (player.identity?.email) {
      const totalSparks = player.history.reduce((a, h) => a + h.sparkIds.length, 0);
      const totalMinutes = player.history.reduce((a, h) => a + h.minutes, 0);
      merged.unshift({
        id: "self",
        email: player.identity.email,
        name: player.identity.name ?? player.identity.email.split("@")[0],
        picture: player.identity.picture,
        ageBand: player.profile?.ageBand ?? "adult",
        skillLevel: player.profile?.skillLevel ?? "explorer",
        signupAt: player.profile?.createdAt ?? Date.now(),
        lastSeenAt: Date.now(),
        xp: player.xp,
        streak: player.streak,
        tier: player.guildTier,
        topInterest: player.profile?.interests?.[0],
        daysActive: Math.min(30, player.history.length),
        totalSparks,
        totalMinutes,
        banned: false,
        isCurrentUser: true,
      });
    }
    void selfMatched;
    setMockUsers(merged);
  }, [
    realUsers,
    config.flags.showDemoData,
    player.identity?.email,
    player.identity?.name,
    player.identity?.picture,
    player.xp,
    player.streak,
    player.guildTier,
    player.profile?.ageBand,
    player.profile?.skillLevel,
    player.profile?.createdAt,
    player.profile?.interests,
    player.history,
  ]);

  const setConfig = useCallback(
    (mutate: (cfg: AdminConfig) => AdminConfig) => dispatch({ type: "set", mutate }),
    []
  );

  const bootstrapAdmin = useCallback(
    (email: string) => {
      const e = email.trim().toLowerCase();
      setConfig((cfg) =>
        cfg.bootstrapped
          ? cfg
          : {
              ...cfg,
              bootstrapped: true,
              admins: cfg.admins.includes(e) ? cfg.admins : [...cfg.admins, e],
            }
      );
    },
    [setConfig]
  );

  const addAdmin = useCallback(
    (email: string) => {
      const e = email.trim().toLowerCase();
      if (!/@gmail\.com$/.test(e)) return false;
      setConfig((cfg) =>
        cfg.admins.map((a) => a.toLowerCase()).includes(e)
          ? cfg
          : { ...cfg, admins: [...cfg.admins, e] }
      );
      return true;
    },
    [setConfig]
  );

  const removeAdmin = useCallback(
    (email: string) => {
      const e = email.trim().toLowerCase();
      setConfig((cfg) => ({
        ...cfg,
        admins: cfg.admins.filter((a) => a.toLowerCase() !== e),
      }));
    },
    [setConfig]
  );

  const updateTemplate = useCallback(
    (tpl: EmailTemplate) =>
      setConfig((cfg) => ({
        ...cfg,
        emailTemplates: { ...cfg.emailTemplates, [tpl.id]: tpl },
      })),
    [setConfig]
  );

  const toggleTemplate = useCallback(
    (id: EmailTemplateId, enabled: boolean) =>
      setConfig((cfg) => ({
        ...cfg,
        emailTemplates: {
          ...cfg.emailTemplates,
          [id]: { ...cfg.emailTemplates[id], enabled },
        },
      })),
    [setConfig]
  );

  const banUser = useCallback((id: string, banned: boolean) => {
    setMockUsers((users) => users.map((u) => (u.id === id ? { ...u, banned } : u)));
  }, []);

  const resetUserProgress = useCallback((id: string) => {
    setMockUsers((users) =>
      users.map((u) =>
        u.id === id ? { ...u, xp: 0, streak: 0, totalSparks: 0, totalMinutes: 0, daysActive: 0 } : u
      )
    );
  }, []);

  const wipeRealUserState = useCallback(
    async (id: string): Promise<boolean> => {
      // Real users have id = `mem0:<email>` (set in the merge effect
      // above). Mock-cohort + the local "self" row don't — for those,
      // fall through to the local resetUserProgress UI behavior.
      if (!id.startsWith("mem0:")) return false;
      const email = id.slice("mem0:".length);
      const token = player.serverSession?.token;
      const base = config.serverAuth.mem0Url;
      if (!token || !base) {
        throw new Error(
          "wipe requires a session JWT and serverAuth.mem0Url — neither is set."
        );
      }
      // Defense-in-depth: never wipe yourself this way. The UI also
      // disables the action on the current admin row, but a stray
      // programmatic call should still bail.
      if (player.identity?.email?.toLowerCase() === email.toLowerCase()) {
        throw new Error("Refusing to wipe the currently signed-in admin.");
      }
      const url = `${base}/v1/state/admin/users/${encodeURIComponent(email)}`;
      const r = await fetch(url, {
        method: "DELETE",
        headers: { authorization: `Bearer ${token}` },
      });
      if (!r.ok) {
        const txt = await r.text().catch(() => "");
        throw new Error(`HTTP ${r.status}${txt ? ` — ${txt.slice(0, 200)}` : ""}`);
      }
      // Trigger a refetch of the real-user list so the table updates.
      setRealUsersRefreshKey((k) => k + 1);
      return true;
    },
    [config.serverAuth.mem0Url, player.serverSession?.token, player.identity?.email]
  );

  const cascadeRemoveRealUser = useCallback(
    async (id: string): Promise<{ ok: boolean; steps?: string }> => {
      // **Permanent removal** — fans across mem0 (user_state, memories,
      // auth.users) AND social-svc (profile + follow/block/event cascade).
      // The user's next sign-in starts a brand-new onboarding flow.
      // Distinct from `wipeRealUserState` (= reset-progress only).
      if (!id.startsWith("mem0:")) return { ok: false };
      const email = id.slice("mem0:".length);
      const token = player.serverSession?.token;
      const base = config.serverAuth.mem0Url;
      if (!token || !base) {
        throw new Error(
          "cascade-remove requires a session JWT and serverAuth.mem0Url — neither is set."
        );
      }
      if (player.identity?.email?.toLowerCase() === email.toLowerCase()) {
        throw new Error(
          "Refusing to cascade-remove the currently signed-in admin."
        );
      }
      const url = `${base}/v1/state/admin/users/${encodeURIComponent(email)}/cascade`;
      const r = await fetch(url, {
        method: "DELETE",
        headers: { authorization: `Bearer ${token}` },
      });
      if (!r.ok) {
        const txt = await r.text().catch(() => "");
        throw new Error(`HTTP ${r.status}${txt ? ` — ${txt.slice(0, 200)}` : ""}`);
      }
      const body = (await r.json().catch(() => ({}))) as { message?: string };
      setRealUsersRefreshKey((k) => k + 1);
      return { ok: true, steps: body.message };
    },
    [config.serverAuth.mem0Url, player.serverSession?.token, player.identity?.email]
  );

  const sendTemplateToUser = useCallback(
    (userId: string, templateId: EmailTemplateId, extraVars: Record<string, string | number> = {}) => {
      const user = mockUsers.find((u) => u.id === userId);
      if (!user) return;
      setConfig((cfg) => {
        const vars = {
          appName: cfg.branding.appName,
          appUrl: typeof window !== "undefined" ? window.location.origin : "",
          accent: cfg.branding.accentColor,
          accent2: cfg.branding.accent2Color,
          logoEmoji: cfg.branding.logoEmoji,
          firstName: user.name.split(" ")[0],
          fullName: user.name,
          email: user.email,
          streak: user.streak,
          xp: user.xp,
          tier: user.tier,
          ...extraVars,
        };
        const { cfg: nextCfg } = queueEmail(cfg, user.email, templateId, vars);
        return nextCfg;
      });
    },
    [mockUsers, setConfig]
  );

  /**
   * Run the email policy then send what survives.
   *
   *   1. Build a plan from the queue (`planEmailFlush`) — applies 24h
   *      cap, supersede-by-priority, unsub block, pause cooldown.
   *   2. For each survivor, hit mem0's `prepare` to mint signed
   *      unsubscribe + open-pixel URLs.
   *   3. Inject the unsubscribe footer + open pixel into the body.
   *   4. Send via the configured provider, with `unsubscribeUrl` set
   *      so sender.ts builds RFC 8058 List-Unsubscribe headers.
   *   5. Roll plan + results back into the queue: blocked items
   *      surface their reason ("superseded" / "rate-limited" / etc.).
   */
  const flushQueue = useCallback(async () => {
    const cfg = config;
    const queued = cfg.emailQueue.filter((q) => q.status === "queued");
    if (queued.length === 0) return;

    const recipientState: Record<string, RecipientPolicyState> = {};
    if (realUsers) {
      for (const u of realUsers.recent) {
        recipientState[u.email.toLowerCase()] = {
          email: u.email,
          email_unsubscribed_at: u.email_unsubscribed_at ?? null,
          email_pause_until: u.email_pause_until ?? null,
          email_log: (u.email_log ?? []) as RecipientPolicyState["email_log"],
        };
      }
    }

    const plan = planEmailFlush({
      policy: cfg.emailPolicy,
      queued,
      sentHistory: cfg.emailQueue.filter((q) => q.status === "sent"),
      recipientState,
    });

    const sessionToken = player.serverSession?.token;
    const mem0Base = cfg.serverAuth.mem0Url;
    const prepareResultsById: Record<
      string,
      { logId?: string; serverDecision?: string; unsubscribeUrl?: string; openPixelUrl?: string }
    > = {};
    if (sessionToken && mem0Base) {
      await Promise.all(
        plan
          .filter((p) => p.outcome === "send")
          .map(async (p) => {
            const res = await callPrepareSend({
              base: mem0Base,
              token: sessionToken,
              to: p.queued.to,
              templateId: p.queued.templateId,
              isTransactional: TRANSACTIONAL_TEMPLATES.has(p.queued.templateId),
            });
            if (!res) return;
            prepareResultsById[p.queued.id] = {
              logId: res.log_id ?? undefined,
              serverDecision: res.decision,
              unsubscribeUrl: res.unsubscribe_url ?? undefined,
              openPixelUrl: res.open_pixel_url ?? undefined,
            };
          }),
      );
    }

    const sendable = plan.filter((p) => p.outcome === "send");
    const sendResults = await Promise.all(
      sendable.map(async (p) => {
        const prep = prepareResultsById[p.queued.id];
        const isTransactional = TRANSACTIONAL_TEMPLATES.has(p.queued.templateId);
        const enriched: typeof p.queued = {
          ...p.queued,
          bodyRendered: injectEmailExtras(p.queued.bodyRendered, {
            unsubscribeUrl: prep?.unsubscribeUrl,
            openPixelUrl: prep?.openPixelUrl,
            appendUnsubscribe: !!prep?.unsubscribeUrl && cfg.emailPolicy.appendUnsubscribe,
            appendOpenPixel: !!prep?.openPixelUrl && cfg.emailPolicy.appendOpenPixel,
            appName: cfg.branding.appName,
            fromAddress: cfg.emailConfig.fromEmail,
          }),
          // Header-level Unsubscribe pill only on non-transactional —
          // celebrations don't get the Gmail-native button.
          unsubscribeUrl:
            !isTransactional && cfg.emailPolicy.appendUnsubscribe
              ? prep?.unsubscribeUrl
              : undefined,
          openPixelUrl: prep?.openPixelUrl,
          prepareLogId: prep?.logId,
          serverDecision: prep?.serverDecision,
        };
        const res = await sendEmail(cfg.emailConfig, enriched, sessionToken);
        return { id: p.queued.id, res };
      }),
    );

    setConfig((cur) => {
      const queueAfterPlan = applyPlanToQueue(cur.emailQueue, plan, prepareResultsById);
      return {
        ...cur,
        emailQueue: queueAfterPlan.map((q) => {
          const hit = sendResults.find((r) => r.id === q.id);
          if (!hit) return q;
          return {
            ...q,
            status: hit.res.ok ? "sent" : "failed",
            error: hit.res.error,
          };
        }),
      };
    });

    if (sendable.length > 0) setRealUsersRefreshKey((k) => k + 1);
  }, [config, setConfig, realUsers, player.serverSession?.token]);

  // Auto-flush debouncer. After every queue mutation, schedule a flush
  // for `policy.autoFlushDebounceSeconds` later. Subsequent queue
  // events extend the timer (debounce). Operator can still hit "Send
  // queue now" to force-fire. Guarded by `policy.autoFlushEnabled`.
  const queuedCount = config.emailQueue.filter((q) => q.status === "queued").length;
  const policyAutoFlush = config.emailPolicy.autoFlushEnabled;
  const policyDebounce = Math.max(0, config.emailPolicy.autoFlushDebounceSeconds);
  useEffect(() => {
    if (!policyAutoFlush) return;
    if (queuedCount === 0) return;
    const handle = setTimeout(() => {
      void flushQueue();
    }, policyDebounce * 1000);
    return () => clearTimeout(handle);
  }, [queuedCount, policyAutoFlush, policyDebounce, flushQueue]);

  /**
   * Manually drop a one-off message into the queue & send. Useful for the
   * "Send test email" button in the Emails tab.
   */
  const sendTestEmail = useCallback(
    async (to: string, templateId: EmailTemplateId): Promise<{ ok: boolean; error?: string }> => {
      const tpl = config.emailTemplates[templateId];
      if (!tpl) return { ok: false, error: "Unknown template id." };
      const vars = {
        appName: config.branding.appName,
        appUrl: typeof window !== "undefined" ? window.location.origin : "",
        accent: config.branding.accentColor,
        accent2: config.branding.accent2Color,
        logoEmoji: config.branding.logoEmoji,
        firstName: "Friend",
        fullName: `${config.branding.appName} test`,
        email: to,
        streak: 7,
        xp: 320,
        tier: "Architect",
        topicName: "AI Foundations",
        level: 1,
      };
      const { cfg: nextCfg, queued } = queueEmail(config, to, templateId, vars);
      const res = await sendEmail(nextCfg.emailConfig, queued, player.serverSession?.token);
      setConfig((cur) => ({
        ...nextCfg,
        emailQueue: nextCfg.emailQueue.map((q) =>
          q.id === queued.id ? { ...q, status: res.ok ? "sent" : "failed", error: res.error } : q
        ),
        // preserve other admin-config edits the admin made since
        // flushQueue might race with this:
        admins: cur.admins,
        bootstrapped: cur.bootstrapped,
        branding: cur.branding,
        flags: cur.flags,
        defaultDailyMinutes: cur.defaultDailyMinutes,
        emailConfig: cur.emailConfig,
        emailTemplates: cur.emailTemplates,
      }));
      return res;
    },
    [config, setConfig]
  );

  const resetAdminConfig = useCallback(() => {
    if (typeof window !== "undefined") window.localStorage.removeItem(ADMIN_STORAGE_KEY);
    dispatch({ type: "init", cfg: defaultAdminConfig() });
  }, []);

  // In production server-auth mode, **only** the server-signed `is_admin`
  // claim from the session JWT (sourced from the operator's ADMIN_EMAILS
  // env var on mem0) grants admin. We deliberately do NOT fall back to
  // the local `admins` allowlist when the JWT is missing — otherwise a
  // user who self-bootstrapped locally (or any tampered admin
  // localStorage) would be granted admin power in the UI. The local
  // allowlist is the demo-mode source of truth only.
  let am: boolean;
  if (config.serverAuth.mode === "production") {
    am = player.serverSession?.isAdmin === true;
  } else {
    am = isAdmin(config, player.identity?.email);
  }

  const realUserCount = realUsers?.count ?? null;

  const value = useMemo<Ctx>(
    () => ({
      config,
      isAdmin: am,
      mockUsers,
      realUserCount,
      realUsersError,
      wipeRealUserState,
      cascadeRemoveRealUser,
      setConfig,
      bootstrapAdmin,
      addAdmin,
      removeAdmin,
      updateTemplate,
      toggleTemplate,
      banUser,
      resetUserProgress,
      sendTemplateToUser,
      flushQueue,
      sendTestEmail,
      resetAdminConfig,
    }),
    [
      config,
      am,
      mockUsers,
      realUserCount,
      realUsersError,
      wipeRealUserState,
      cascadeRemoveRealUser,
      setConfig,
      bootstrapAdmin,
      addAdmin,
      removeAdmin,
      updateTemplate,
      toggleTemplate,
      banUser,
      resetUserProgress,
      sendTemplateToUser,
      flushQueue,
      sendTestEmail,
      resetAdminConfig,
    ]
  );

  return <AdminCtx.Provider value={value}>{children}</AdminCtx.Provider>;
}

export function useAdmin() {
  const ctx = useContext(AdminCtx);
  if (!ctx) throw new Error("useAdmin must be used inside AdminProvider");
  return ctx;
}

export function useAnalytics() {
  const { mockUsers } = useAdmin();
  return useMemo(() => buildAnalytics(mockUsers), [mockUsers]);
}
