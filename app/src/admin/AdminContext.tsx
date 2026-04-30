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

  // Build the deterministic mock cohort once, then merge the current local user.
  useEffect(() => {
    const base = buildMockUsers();
    const merged: MockUser[] = base.slice();
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
    setMockUsers(merged);
  }, [
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
      queued.map(async (q) => ({ q, res: await sendEmail(cfg.emailConfig, q) }))
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
        fullName: "BuilderQuest test",
        email: to,
        streak: 7,
        xp: 320,
        tier: "Architect",
        topicName: "AI Foundations",
        level: 1,
      };
      const { cfg: nextCfg, queued } = queueEmail(config, to, templateId, vars);
      const res = await sendEmail(nextCfg.emailConfig, queued);
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

  const am = isAdmin(config, player.identity?.email);

  const value = useMemo<Ctx>(
    () => ({
      config,
      isAdmin: am,
      mockUsers,
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
