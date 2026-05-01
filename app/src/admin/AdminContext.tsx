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
import { usePlayer } from "../store/PlayerContext";
import { tierForXP } from "../store/game";

/** Real signed-up user as returned by mem0's `/v1/state/admin/users`.
 *  user_state is the canonical "who has signed in" table — every Google
 *  sign-in that mutates SPA state writes a row via PUT /v1/state. */
interface RealUserSummary {
  email: string;
  updated_at: string | null;
  xp: number;
  streak: number;
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
  }, [config.serverAuth.mem0Url, player.serverSession?.token]);

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
        const seenAt = u.updated_at ? Date.parse(u.updated_at) : Date.now();
        merged.unshift({
          id: `mem0:${u.email}`,
          email: u.email,
          name: u.email.split("@")[0],
          ageBand: "adult",
          skillLevel: "builder",
          // user_state.created_at isn't exposed yet — last-seen is the
          // best signupAt approximation we have. Worst case the user
          // appears as a recent signup; better than missing entirely.
          signupAt: seenAt,
          lastSeenAt: seenAt,
          xp: u.xp,
          streak: u.streak,
          tier: tierForXP(u.xp),
          // Coarse approximations from xp; the opaque blob has the real
          // numbers, but exposing them requires a richer admin endpoint.
          daysActive: Math.max(1, Math.min(30, Math.floor(u.xp / 30))),
          totalSparks: Math.max(1, Math.floor(u.xp / 10)),
          totalMinutes: Math.max(1, Math.floor(u.xp / 8)),
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
   * Send everything in the queue using the configured provider. Each message
   * is updated with `sent` or `failed` (+ error). Browser-side providers
   * supported: Resend, EmailJS, smtp-relay (your own webhook). For
   * Postmark/SendGrid/SES use a server-side relay.
   */
  const flushQueue = useCallback(async () => {
    const cfg = config;
    const queued = cfg.emailQueue.filter((q) => q.status === "queued");
    if (queued.length === 0) return;
    const results = await Promise.all(
      queued.map(async (q) => ({ q, res: await sendEmail(cfg.emailConfig, q, player.serverSession?.token) }))
    );
    setConfig((cur) => ({
      ...cur,
      emailQueue: cur.emailQueue.map((q) => {
        const hit = results.find((r) => r.q.id === q.id);
        if (!hit) return q;
        return {
          ...q,
          status: hit.res.ok ? "sent" : "failed",
          error: hit.res.error,
        };
      }),
    }));
  }, [config, setConfig]);

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
