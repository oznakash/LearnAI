import type { EmailTemplate, AdminConfig, QueuedEmail, EmailTemplateId } from "./types";
import { defaultAdminConfig } from "./defaults";

export const ADMIN_STORAGE_KEY = "builderquest:admin:v1";

/**
 * One-shot legacy-string migrations for cached admin configs that were
 * saved before the LearnAI rebrand landed. We forward-merge fresh fields,
 * but for a small handful of values we also overwrite the cached default
 * if it matches the historical default verbatim — that way returning users
 * see "LearnAI / AI" instead of "BuilderQuest / BQ" on their next refresh
 * without having to reset their config.
 *
 * Keep this list tight. It must only ever migrate values that match the
 * historical default exactly — anything customised by the operator is left
 * untouched.
 */
function migrateLegacyBranding(
  saved: Partial<AdminConfig["branding"]> | undefined,
  fresh: AdminConfig["branding"]
): AdminConfig["branding"] {
  const merged = { ...fresh, ...(saved ?? {}) };
  if (merged.appName === "BuilderQuest") merged.appName = fresh.appName;
  if (merged.logoEmoji === "BQ") merged.logoEmoji = fresh.logoEmoji;
  // Mascot name: legacy default was "Synapse"; migrate to fresh default
  // ("EmDash") so returning users see the new buddy. Custom names (e.g.,
  // a Spanish-LearnAI fork called their mascot "Hola") are left alone.
  if (!merged.mascotName || merged.mascotName === "Synapse") {
    merged.mascotName = fresh.mascotName;
  }
  // XP unit: legacy was the implicit "Synapses" — surface it explicitly
  // and migrate to the fresh default. Custom values are preserved.
  if (!merged.xpUnit || merged.xpUnit === "Synapses") {
    merged.xpUnit = fresh.xpUnit;
  }
  return merged;
}

/**
 * One-shot migration for the deprecated `flags.offlineMode` master switch.
 *
 * Old model: offlineMode default-true → cognition was *off* for everyone
 * unless the operator explicitly turned it on. That was the wrong default
 * (and silently bit users when the runtime cache and React state went
 * out of sync). New model: cognition is on for everyone by default; the
 * admin opts in to per-user opt-out via `memoryPlayerOptIn`.
 *
 * Force any saved `offlineMode: true` back to `false` here so returning
 * users land on the new behaviour without having to flip anything.
 */
function migrateLegacyFlags(flags: AdminConfig["flags"]): AdminConfig["flags"] {
  if (flags.offlineMode === true) {
    return { ...flags, offlineMode: false };
  }
  return flags;
}

function migrateLegacyEmail(
  saved: Partial<AdminConfig["emailConfig"]> | undefined,
  fresh: AdminConfig["emailConfig"]
): AdminConfig["emailConfig"] {
  const merged = { ...fresh, ...(saved ?? {}) };
  if (merged.fromName === "BuilderQuest") merged.fromName = fresh.fromName;
  return merged;
}

export function loadAdminConfig(): AdminConfig {
  if (typeof window === "undefined") return defaultAdminConfig();
  try {
    const raw = window.localStorage.getItem(ADMIN_STORAGE_KEY);
    if (!raw) return defaultAdminConfig();
    const parsed = JSON.parse(raw) as Partial<AdminConfig>;
    const base = defaultAdminConfig();
    return {
      ...base,
      ...parsed,
      branding: migrateLegacyBranding(parsed.branding, base.branding),
      flags: migrateLegacyFlags({ ...base.flags, ...(parsed.flags ?? {}) }),
      emailConfig: migrateLegacyEmail(parsed.emailConfig, base.emailConfig),
      // Forward-compat for the email policy added in #93. Saved configs
      // from before the rate-limit work get the defaults filled in.
      // Operator's own knobs win on collisions. priorityOrder is replaced
      // wholesale (not merged) when set so operators can drop a template.
      emailPolicy: {
        ...base.emailPolicy,
        ...(parsed.emailPolicy ?? {}),
        priorityOrder:
          parsed.emailPolicy?.priorityOrder ?? base.emailPolicy.priorityOrder,
      },
      emailTemplates: { ...base.emailTemplates, ...(parsed.emailTemplates ?? {}) },
      admins: parsed.admins ?? [],
      emailQueue: parsed.emailQueue ?? [],
      tuning: {
        ...base.tuning,
        ...(parsed.tuning ?? {}),
        xp: { ...base.tuning.xp, ...((parsed.tuning?.xp) ?? {}) },
        focus: { ...base.tuning.focus, ...((parsed.tuning?.focus) ?? {}) },
        tiers: { ...base.tuning.tiers, ...((parsed.tuning?.tiers) ?? {}) },
      },
      contentOverrides: {
        topics: parsed.contentOverrides?.topics ?? {},
        extras: parsed.contentOverrides?.extras ?? [],
      },
      // Forward-compat: legacy saved configs predate the creator
      // registry. Merge seed defaults under any saved overrides so the
      // built-in creators (Lenny) always exist, and the operator's
      // custom creators win on collisions.
      creators: { ...base.creators, ...(parsed.creators ?? {}) },
      promptStudio: { ...base.promptStudio, ...(parsed.promptStudio ?? {}) },
      memoryConfig: { ...base.memoryConfig, ...(parsed.memoryConfig ?? {}) },
      socialConfig: {
        ...base.socialConfig,
        ...(parsed.socialConfig ?? {}),
        streamWeights: {
          ...base.socialConfig.streamWeights,
          ...(parsed.socialConfig?.streamWeights ?? {}),
        },
        // Forward-compat: older saved configs predate `publicProfile`.
        // Deep-merge defaults so a hand-edited blob can override one
        // toggle without losing the rest.
        publicProfile: {
          ...base.socialConfig.publicProfile,
          ...(parsed.socialConfig?.publicProfile ?? {}),
          defaults: {
            ...base.socialConfig.publicProfile.defaults,
            ...(parsed.socialConfig?.publicProfile?.defaults ?? {}),
          },
        },
      },
      serverAuth: { ...base.serverAuth, ...(parsed.serverAuth ?? {}) },
    };
  } catch {
    return defaultAdminConfig();
  }
}

export function saveAdminConfig(cfg: AdminConfig) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(cfg));
}

export function isAdmin(cfg: AdminConfig, email?: string): boolean {
  if (!email) return false;
  const e = email.trim().toLowerCase();
  return cfg.admins.map((a) => a.toLowerCase()).includes(e);
}

/** Render a template by substituting `{{name}}` placeholders. */
export function renderTemplate(
  template: string,
  vars: Record<string, string | number | undefined>
): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
    const v = vars[key];
    return v === undefined || v === null ? "" : String(v);
  });
}

export function renderEmail(
  tpl: EmailTemplate,
  vars: Record<string, string | number | undefined>
): { subject: string; body: string } {
  return {
    subject: renderTemplate(tpl.subject, vars),
    body: renderTemplate(tpl.body, vars),
  };
}

export function queueEmail(
  cfg: AdminConfig,
  to: string,
  templateId: EmailTemplateId,
  vars: Record<string, string | number | undefined>
): { cfg: AdminConfig; queued: QueuedEmail } {
  const tpl = cfg.emailTemplates[templateId];
  const rendered = renderEmail(tpl, vars);
  const queued: QueuedEmail = {
    id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    to,
    templateId,
    subjectRendered: rendered.subject,
    bodyRendered: rendered.body,
    queuedAt: Date.now(),
    status: "queued",
  };
  return {
    cfg: { ...cfg, emailQueue: [queued, ...cfg.emailQueue].slice(0, 200) },
    queued,
  };
}

export function markQueueSent(cfg: AdminConfig, id: string): AdminConfig {
  return {
    ...cfg,
    emailQueue: cfg.emailQueue.map((q) =>
      q.id === id ? { ...q, status: "sent" } : q
    ),
  };
}

/** Sample template variables, used for live preview in the editor. */
export function sampleTemplateVars(cfg: AdminConfig): Record<string, string | number> {
  return {
    appName: cfg.branding.appName,
    appUrl: typeof window !== "undefined" ? window.location.origin : "https://builderquest.app",
    accent: cfg.branding.accentColor,
    accent2: cfg.branding.accent2Color,
    logoEmoji: cfg.branding.logoEmoji,
    firstName: "Alex",
    fullName: "Alex Builder",
    email: "alex@gmail.com",
    interestsList: "AI Foundations, AI Builder, AI Trends",
    dailyMinutes: cfg.defaultDailyMinutes,
    streak: 7,
    xp: 12,
    xpThisWeek: 184,
    sparksThisWeek: 22,
    minutesThisWeek: 41,
    topTopic: "AI Foundations",
    tier: "Architect",
    nextTier: "Visionary",
    nextTierThreshold: 500,
    topicName: "LLMs & Cognition",
    level: 3,
  };
}
