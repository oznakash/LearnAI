import { describe, it, expect, beforeEach } from "vitest";
import {
  isAdmin,
  queueEmail,
  renderEmail,
  renderTemplate,
  sampleTemplateVars,
} from "../admin/store";
import { defaultAdminConfig, DEFAULT_TEMPLATES } from "../admin/defaults";
import { buildAnalytics, buildMockUsers } from "../admin/mockUsers";
import { ADMIN_STORAGE_KEY, loadAdminConfig } from "../admin/store";

describe("admin allowlist", () => {
  it("recognizes admins case-insensitively", () => {
    const cfg = { ...defaultAdminConfig(), admins: ["alex@gmail.com"] };
    expect(isAdmin(cfg, "alex@gmail.com")).toBe(true);
    expect(isAdmin(cfg, "Alex@Gmail.com")).toBe(true);
    expect(isAdmin(cfg, "bob@gmail.com")).toBe(false);
    expect(isAdmin(cfg, undefined)).toBe(false);
  });
});

describe("template rendering", () => {
  it("substitutes {{vars}} in subject and body", () => {
    const out = renderTemplate("Hello {{name}}, your streak is {{streak}}", {
      name: "Alex",
      streak: 7,
    });
    expect(out).toBe("Hello Alex, your streak is 7");
  });

  it("leaves missing vars blank without throwing", () => {
    const out = renderTemplate("a={{a}}, b={{b}}", { a: "x" });
    expect(out).toBe("a=x, b=");
  });

  it("renderEmail returns rendered subject and body", () => {
    const cfg = defaultAdminConfig();
    const sample = sampleTemplateVars(cfg);
    const r = renderEmail(DEFAULT_TEMPLATES.welcome, sample);
    expect(r.subject).toContain(cfg.branding.appName);
    expect(r.subject).toContain("Alex");
    expect(r.body).toContain(cfg.branding.appName);
  });

  it("DEFAULT_TEMPLATES has all 8 lifecycle templates", () => {
    expect(Object.keys(DEFAULT_TEMPLATES)).toHaveLength(8);
    for (const t of Object.values(DEFAULT_TEMPLATES)) {
      expect(t.id).toBeTruthy();
      expect(t.name).toBeTruthy();
      expect(t.subject).toBeTruthy();
      expect(t.body).toBeTruthy();
      expect(t.trigger).toBeTruthy();
    }
  });
});

describe("email queue", () => {
  it("queues emails with rendered fields", () => {
    const cfg = defaultAdminConfig();
    const { cfg: nextCfg, queued } = queueEmail(cfg, "alex@gmail.com", "welcome", {
      ...sampleTemplateVars(cfg),
      firstName: "Alex",
    });
    expect(nextCfg.emailQueue).toHaveLength(1);
    expect(queued.to).toBe("alex@gmail.com");
    expect(queued.status).toBe("queued");
    expect(queued.subjectRendered).toContain("Alex");
  });
});

describe("loadAdminConfig — legacy-string migration", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  it("rewrites stale appName='BuilderQuest' to the fresh default ('LearnAI')", () => {
    localStorage.setItem(
      ADMIN_STORAGE_KEY,
      JSON.stringify({ branding: { appName: "BuilderQuest", logoEmoji: "BQ" } })
    );
    const cfg = loadAdminConfig();
    expect(cfg.branding.appName).toBe("LearnAI");
    expect(cfg.branding.logoEmoji).toBe("AI");
  });

  it("preserves a custom appName the operator explicitly set", () => {
    localStorage.setItem(
      ADMIN_STORAGE_KEY,
      JSON.stringify({ branding: { appName: "ChessAI", logoEmoji: "CA" } })
    );
    const cfg = loadAdminConfig();
    expect(cfg.branding.appName).toBe("ChessAI");
    expect(cfg.branding.logoEmoji).toBe("CA");
  });

  it("rewrites stale email fromName='BuilderQuest' to the fresh default", () => {
    localStorage.setItem(
      ADMIN_STORAGE_KEY,
      JSON.stringify({ emailConfig: { provider: "none", fromName: "BuilderQuest", fromEmail: "x@y.com" } })
    );
    const cfg = loadAdminConfig();
    expect(cfg.emailConfig.fromName).toBe("LearnAI");
  });
});

describe("mock users + analytics", () => {
  const users = buildMockUsers(1714000000000);
  it("produces a deterministic cohort", () => {
    expect(users.length).toBeGreaterThan(20);
    expect(users.every((u) => u.email.endsWith("@gmail.com"))).toBe(true);
  });
  it("buildAnalytics computes a sane bundle", () => {
    const a = buildAnalytics(users, 1714000000000);
    expect(a.totalUsers).toBe(users.length);
    expect(a.funnel.signedUp).toBe(users.length);
    expect(a.funnel.onboarded).toBeLessThanOrEqual(a.funnel.signedUp);
    expect(a.funnel.firstSpark).toBeLessThanOrEqual(a.funnel.onboarded);
    expect(a.dau).toBeGreaterThanOrEqual(0);
    expect(a.wau).toBeGreaterThanOrEqual(a.dau);
    expect(a.mau).toBeGreaterThanOrEqual(a.wau);
    expect(a.newSignupsByDay.length).toBe(30);
    expect(a.topicPopularity.length).toBeGreaterThan(0);
  });
});
