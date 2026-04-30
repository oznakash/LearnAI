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
  return merged;
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
      flags: { ...base.flags, ...(parsed.flags ?? {}) },
      emailConfig: migrateLegacyEmail(parsed.emailConfig, base.emailConfig),
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
      promptStudio: { ...base.promptStudio, ...(parsed.promptStudio ?? {}) },
      memoryConfig: { ...base.memoryConfig, ...(parsed.memoryConfig ?? {}) },
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
