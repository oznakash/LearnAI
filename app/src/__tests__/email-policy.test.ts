import { describe, expect, it } from "vitest";
import {
  injectEmailExtras,
  maybePauseFromUnreads,
  planEmailFlush,
  TRANSACTIONAL_TEMPLATES,
} from "../admin/emailPolicy";
import type { EmailPolicy, QueuedEmail } from "../admin/types";

const policy = (over: Partial<EmailPolicy> = {}): EmailPolicy => ({
  enabled: true,
  capPerWindowHours: 24,
  transactionalBypass: false,
  autoFlushDebounceSeconds: 30,
  autoFlushEnabled: true,
  appendUnsubscribe: true,
  appendOpenPixel: true,
  pauseOnUnreadEnabled: true,
  pauseOnUnreadCount: 2,
  pauseDurationDays: 30,
  priorityOrder: [
    "streak-save",
    "boss-beaten",
    "level-up",
    "first-spark",
    "welcome",
    "weekly-digest",
    "re-engagement",
    "daily-reminder",
  ],
  ...over,
});

const q = (
  over: Partial<QueuedEmail> & { id: string; templateId: QueuedEmail["templateId"]; to: string },
): QueuedEmail => ({
  subjectRendered: "x",
  bodyRendered: "<body><p>x</p></body>",
  queuedAt: 0,
  status: "queued",
  ...over,
});

describe("planEmailFlush", () => {
  it("disabled policy: every queued row passes through as send", () => {
    const queued = [
      q({ id: "a", to: "u@x", templateId: "welcome" }),
      q({ id: "b", to: "u@x", templateId: "first-spark" }),
    ];
    const plan = planEmailFlush({
      policy: policy({ enabled: false }),
      queued,
      sentHistory: [],
      recipientState: {},
    });
    expect(plan.every((p) => p.outcome === "send")).toBe(true);
  });

  it("competing transactionals same recipient → first-spark wins, welcome superseded", () => {
    const queued = [
      q({ id: "a", to: "u@x", templateId: "welcome" }),
      q({ id: "b", to: "u@x", templateId: "first-spark" }),
    ];
    const plan = planEmailFlush({
      policy: policy(),
      queued,
      sentHistory: [],
      recipientState: {},
    });
    const winner = plan.find((p) => p.outcome === "send");
    expect(winner?.queued.templateId).toBe("first-spark");
    const loser = plan.find((p) => p.queued.id === "a");
    expect(loser?.outcome).toBe("superseded");
    expect(loser?.reason).toMatch(/won priority/);
  });

  it("recent sent within cap → new queue rate-limited", () => {
    const now = 1_000_000_000;
    const queued = [q({ id: "a", to: "u@x", templateId: "welcome", queuedAt: now })];
    const sentHistory: QueuedEmail[] = [
      q({
        id: "prev",
        to: "u@x",
        templateId: "first-spark",
        status: "sent",
        queuedAt: now - 60 * 60 * 1000, // 1h ago
      }),
    ];
    const plan = planEmailFlush({
      policy: policy(),
      queued,
      sentHistory,
      recipientState: {},
      now,
    });
    expect(plan[0]?.outcome).toBe("rate-limited");
  });

  it("transactionalBypass=true lets a transactional through inside the cap", () => {
    const now = 1_000_000_000;
    const queued = [q({ id: "a", to: "u@x", templateId: "first-spark", queuedAt: now })];
    const sentHistory: QueuedEmail[] = [
      q({
        id: "prev",
        to: "u@x",
        templateId: "weekly-digest",
        status: "sent",
        queuedAt: now - 60 * 60 * 1000,
      }),
    ];
    const plan = planEmailFlush({
      policy: policy({ transactionalBypass: true }),
      queued,
      sentHistory,
      recipientState: {},
      now,
    });
    expect(plan[0]?.outcome).toBe("send");
  });

  it("unsubscribed recipient → all queued blocked", () => {
    const queued = [
      q({ id: "a", to: "u@x", templateId: "welcome" }),
      q({ id: "b", to: "u@x", templateId: "first-spark" }),
    ];
    const plan = planEmailFlush({
      policy: policy(),
      queued,
      sentHistory: [],
      recipientState: { "u@x": { email: "u@x", email_unsubscribed_at: 12345 } },
    });
    expect(plan.every((p) => p.outcome === "unsubscribed")).toBe(true);
    expect(plan[0]?.reason).toMatch(/opted out/);
  });

  it("paused recipient → all queued blocked with cooldown reason", () => {
    const now = 1_000_000_000;
    const queued = [q({ id: "a", to: "u@x", templateId: "welcome" })];
    const plan = planEmailFlush({
      policy: policy(),
      queued,
      sentHistory: [],
      recipientState: {
        "u@x": { email: "u@x", email_pause_until: now + 5 * 24 * 60 * 60 * 1000 },
      },
      now,
    });
    expect(plan[0]?.outcome).toBe("paused");
    expect(plan[0]?.reason).toMatch(/cooldown/);
  });

  it("server-side email_log informs cap window", () => {
    const now = 1_000_000_000;
    const queued = [q({ id: "a", to: "u@x", templateId: "welcome", queuedAt: now })];
    const plan = planEmailFlush({
      policy: policy(),
      queued,
      sentHistory: [],
      recipientState: {
        "u@x": {
          email: "u@x",
          email_log: [{ tpl: "first-spark", sent_at: now - 60 * 60 * 1000, opened_at: null }],
        },
      },
      now,
    });
    expect(plan[0]?.outcome).toBe("rate-limited");
  });
});

describe("maybePauseFromUnreads", () => {
  it("returns null when fewer than threshold entries", () => {
    expect(
      maybePauseFromUnreads(
        { email: "u@x", email_log: [{ sent_at: 1, opened_at: null }] },
        policy(),
      ),
    ).toBe(null);
  });

  it("returns a future timestamp when last 2 sends are unread + old", () => {
    const oldTs = Date.now() - 48 * 60 * 60 * 1000;
    const olderTs = oldTs - 24 * 60 * 60 * 1000;
    const out = maybePauseFromUnreads(
      {
        email: "u@x",
        email_log: [
          { sent_at: oldTs, opened_at: null },
          { sent_at: olderTs, opened_at: null },
        ],
      },
      policy(),
    );
    expect(out).not.toBe(null);
    expect((out as number) > Date.now()).toBe(true);
  });

  it("returns null when any of the recent N is opened", () => {
    expect(
      maybePauseFromUnreads(
        {
          email: "u@x",
          email_log: [
            { sent_at: 1, opened_at: 2 },
            { sent_at: 0, opened_at: null },
          ],
        },
        policy(),
      ),
    ).toBe(null);
  });
});

describe("injectEmailExtras", () => {
  it("appends unsubscribe footer + tracking pixel before </body>", () => {
    const out = injectEmailExtras("<html><body><p>hi</p></body></html>", {
      unsubscribeUrl: "https://x.test/u?token=abc",
      openPixelUrl: "https://x.test/p?token=def",
      appendUnsubscribe: true,
      appendOpenPixel: true,
      appName: "LearnAI",
      fromAddress: "from@x.test",
    });
    expect(out).toContain('href="https://x.test/u?token=abc"');
    expect(out).toContain('src="https://x.test/p?token=def"');
    // Both injected before the closing body tag.
    expect(out.indexOf("Unsubscribe with one click")).toBeLessThan(
      out.indexOf("</body>"),
    );
  });

  it("no-ops when policy flags are off", () => {
    const out = injectEmailExtras("<html><body>hi</body></html>", {
      unsubscribeUrl: "https://x.test/u",
      openPixelUrl: "https://x.test/p",
      appendUnsubscribe: false,
      appendOpenPixel: false,
      appName: "LearnAI",
      fromAddress: "from@x.test",
    });
    expect(out).toBe("<html><body>hi</body></html>");
  });
});

describe("TRANSACTIONAL_TEMPLATES", () => {
  it("covers exactly the celebrations", () => {
    expect(TRANSACTIONAL_TEMPLATES.has("welcome")).toBe(true);
    expect(TRANSACTIONAL_TEMPLATES.has("first-spark")).toBe(true);
    expect(TRANSACTIONAL_TEMPLATES.has("level-up")).toBe(true);
    expect(TRANSACTIONAL_TEMPLATES.has("boss-beaten")).toBe(true);
    expect(TRANSACTIONAL_TEMPLATES.has("streak-save")).toBe(true);
    expect(TRANSACTIONAL_TEMPLATES.has("daily-reminder")).toBe(false);
    expect(TRANSACTIONAL_TEMPLATES.has("re-engagement")).toBe(false);
    expect(TRANSACTIONAL_TEMPLATES.has("weekly-digest")).toBe(false);
  });
});
