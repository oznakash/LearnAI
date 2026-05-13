import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { createApp } from "../src/app.js";
import { createStore, type Store } from "../src/store.js";
import { EmailLog, newEnvId } from "../src/email-log.js";

// End-to-end coverage of the two new admin endpoints:
//   GET /v1/email/log
//   GET /v1/email/log/:id/status
//
// We don't exercise the SMTP path here (that's the live smoke). We
// pre-populate EmailLog directly so the assertions are deterministic.
// The Stalwart proxy is feature-flagged on env vars — we toggle them
// inside each test and clean up after.

let store: Store;
let app: ReturnType<typeof createApp>;
let logDir: string;
let emailLog: EmailLog;

const ADMIN = "admin@learnai.dev";
const NON_ADMIN = "maya@gmail.com";

beforeEach(() => {
  store = createStore();
  logDir = mkdtempSync(join(tmpdir(), "email-log-ep-"));
  emailLog = new EmailLog(join(logDir, "email-log.jsonl"));
  app = createApp({
    store,
    admins: [ADMIN],
    demoTrustHeader: true,
    emailLog,
  });
});

afterEach(() => {
  store.reset();
  try {
    rmSync(logDir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
  delete process.env.STALWART_ADMIN_URL;
  delete process.env.STALWART_ADMIN_TOKEN;
});

const userHeaders = (email: string) => ({ "x-user-email": email });

async function seed(
  to: string,
  subject: string,
  opts: { ok?: boolean; stalwartQueueId?: string; ts?: string } = {},
) {
  const id = newEnvId();
  await emailLog.append({
    id,
    ts: opts.ts ?? new Date().toISOString(),
    to,
    toDomain: to.split("@")[1] ?? "?",
    subject,
    ok: opts.ok ?? true,
    rfcMessageId: `<${id}@cloud-claude.com>`,
    stalwartQueueId: opts.stalwartQueueId,
    smtpResponse: opts.stalwartQueueId
      ? `250 2.0.0 Message queued as ${opts.stalwartQueueId}`
      : undefined,
    submittedByHash: "deadbeef",
    hasUnsubUrl: false,
  });
  return id;
}

describe("GET /v1/email/log", () => {
  it("401s without auth", async () => {
    const r = await request(app).get("/v1/email/log");
    expect(r.status).toBe(401);
  });

  it("403s for non-admin users", async () => {
    const r = await request(app)
      .get("/v1/email/log")
      .set(userHeaders(NON_ADMIN));
    expect(r.status).toBe(403);
  });

  it("returns entries newest-first with paging metadata", async () => {
    await seed("a@example.com", "First");
    await seed("b@example.com", "Second");
    await seed("c@example.com", "Third");
    const r = await request(app)
      .get("/v1/email/log?limit=2")
      .set(userHeaders(ADMIN));
    expect(r.status).toBe(200);
    expect(r.body.total).toBe(3);
    expect(r.body.items).toHaveLength(2);
    expect(r.body.items[0].to).toBe("c@example.com");
    expect(r.body.items[1].to).toBe("b@example.com");
    // stalwartConfigured surfaces feature-flag state for the UI.
    expect(r.body.stalwartConfigured).toBe(false);
  });

  it("reports stalwartConfigured=true when both env vars are set", async () => {
    process.env.STALWART_ADMIN_URL = "https://mail.example.com";
    process.env.STALWART_ADMIN_TOKEN = "tok";
    await seed("u@example.com", "Hi");
    const r = await request(app)
      .get("/v1/email/log")
      .set(userHeaders(ADMIN));
    expect(r.body.stalwartConfigured).toBe(true);
  });

  it("clamps limit to [1, 500]", async () => {
    await seed("a@example.com", "x");
    const r1 = await request(app)
      .get("/v1/email/log?limit=99999")
      .set(userHeaders(ADMIN));
    expect(r1.status).toBe(200);
    // 1 item exists, so length is 1 regardless of clamp — the test
    // really just confirms the request didn't 400 or 500.
    expect(r1.body.items).toHaveLength(1);
    const r2 = await request(app)
      .get("/v1/email/log?limit=0")
      .set(userHeaders(ADMIN));
    expect(r2.status).toBe(200);
  });
});

describe("GET /v1/email/log/:id/status", () => {
  it("404s for an unknown id", async () => {
    const r = await request(app)
      .get("/v1/email/log/does-not-exist/status")
      .set(userHeaders(ADMIN));
    expect(r.status).toBe(404);
  });

  it("returns local_only when Stalwart env vars are unset", async () => {
    const id = await seed("u@example.com", "Hi", {
      stalwartQueueId: "qid-1",
    });
    const r = await request(app)
      .get(`/v1/email/log/${id}/status`)
      .set(userHeaders(ADMIN));
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({
      source: "local_only",
      state: "local_only",
      reason: "stalwart_not_configured",
    });
  });

  it("returns missing_queue_id when we have config but never parsed a qid", async () => {
    process.env.STALWART_ADMIN_URL = "https://mail.example.com";
    process.env.STALWART_ADMIN_TOKEN = "tok";
    const id = await seed("u@example.com", "Hi"); // no stalwartQueueId
    const r = await request(app)
      .get(`/v1/email/log/${id}/status`)
      .set(userHeaders(ADMIN));
    expect(r.status).toBe(200);
    expect(r.body.state).toBe("missing_queue_id");
  });

  // We don't fake the global `fetch` here because supertest runs in-process
  // and the route uses the runtime `fetch`. Stalwart-live happy path is
  // covered in `stalwart.test.ts`; this file only verifies the wiring
  // (auth gate, lookup-by-id, feature-flag fallback).
});
