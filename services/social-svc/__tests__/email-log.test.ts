import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  EmailLog,
  newEnvId,
  parseStalwartQueueId,
  type EmailLogEntry,
} from "../src/email-log.js";

// Append-only audit log of every /v1/email/send. The questions these
// tests are answering: (1) does the JSONL roundtrip preserve every
// field we care about for the audit; (2) does the Stalwart-id parser
// handle the response shapes Stalwart actually returns plus the
// graceful-degrade cases (postfix-style 250s, undefined input); (3)
// does the log survive partial-write corruption without 500ing the
// admin endpoint.

function mkEntry(overrides: Partial<EmailLogEntry> = {}): EmailLogEntry {
  return {
    id: newEnvId(),
    ts: new Date().toISOString(),
    to: "u@example.com",
    toDomain: "example.com",
    subject: "Welcome to LearnAI",
    ok: true,
    rfcMessageId: "<abc@cloud-claude.com>",
    stalwartQueueId: "217700302698266624",
    smtpResponse: "250 2.0.0 Message queued as 217700302698266624",
    submittedByHash: "deadbeef",
    hasUnsubUrl: false,
    ...overrides,
  };
}

describe("newEnvId", () => {
  it("produces unique, sortable ids", () => {
    const a = newEnvId();
    const b = newEnvId();
    expect(a).toMatch(/^el-[a-z0-9]+-[a-f0-9]{4}$/);
    expect(a).not.toBe(b);
  });
});

describe("parseStalwartQueueId", () => {
  it("extracts the id from the canonical Stalwart 'queued as' form", () => {
    expect(
      parseStalwartQueueId("250 2.0.0 Message queued as 217700302698266624"),
    ).toBe("217700302698266624");
  });

  it("extracts the id from the 'queued with id' form", () => {
    expect(
      parseStalwartQueueId("250 2.0.0 Message queued with id ABCDEF123"),
    ).toBe("ABCDEF123");
  });

  it("extracts the id from the 'id=' form", () => {
    expect(parseStalwartQueueId("250 2.0.0 OK id=xyz-789_abc")).toBe(
      "xyz-789_abc",
    );
  });

  it("returns undefined for postfix-style responses we don't recognise", () => {
    // Postfix: "250 ok 1715608800 qp 12345" — we don't try to parse this
    // because the queue id isn't the join key for any of our admin APIs.
    expect(parseStalwartQueueId("250 ok 1715608800 qp 12345")).toBeUndefined();
  });

  it("returns undefined for sendmail-style responses", () => {
    expect(
      parseStalwartQueueId("250 2.0.0 mAAAA Message accepted"),
    ).toBeUndefined();
  });

  it("returns undefined for empty / undefined / non-250 input", () => {
    expect(parseStalwartQueueId(undefined)).toBeUndefined();
    expect(parseStalwartQueueId("")).toBeUndefined();
    expect(
      parseStalwartQueueId("500 internal error"),
    ).toBeUndefined();
  });

  it("is case-insensitive on the matching prefix", () => {
    expect(parseStalwartQueueId("250 2.0.0 MESSAGE QUEUED AS 1234")).toBe(
      "1234",
    );
    expect(parseStalwartQueueId("250 ok ID=1234")).toBe("1234");
  });
});

describe("EmailLog", () => {
  let dir: string;
  let path: string;
  let log: EmailLog;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "email-log-"));
    path = join(dir, "email-log.jsonl");
    log = new EmailLog(path);
  });

  it("starts empty when the file does not exist", async () => {
    const items = await log.read({ limit: 50, offset: 0 });
    expect(items).toEqual([]);
    expect(await log.count()).toBe(0);
  });

  it("roundtrips a single entry through JSONL", async () => {
    const e = mkEntry({ id: "el-test-0001" });
    await log.append(e);
    const back = await log.findById("el-test-0001");
    expect(back).toMatchObject({
      id: "el-test-0001",
      to: "u@example.com",
      stalwartQueueId: "217700302698266624",
      ok: true,
    });
  });

  it("returns entries newest-first when reading", async () => {
    await log.append(mkEntry({ id: "first", subject: "First" }));
    await log.append(mkEntry({ id: "second", subject: "Second" }));
    await log.append(mkEntry({ id: "third", subject: "Third" }));
    const items = await log.read({ limit: 10, offset: 0 });
    expect(items.map((i) => i.id)).toEqual(["third", "second", "first"]);
  });

  it("honours limit and offset for paging", async () => {
    for (let i = 0; i < 5; i++) {
      await log.append(mkEntry({ id: `e${i}` }));
    }
    const page1 = await log.read({ limit: 2, offset: 0 });
    const page2 = await log.read({ limit: 2, offset: 2 });
    expect(page1.map((i) => i.id)).toEqual(["e4", "e3"]);
    expect(page2.map((i) => i.id)).toEqual(["e2", "e1"]);
    expect(await log.count()).toBe(5);
  });

  it("finds by Stalwart queue id", async () => {
    await log.append(mkEntry({ id: "row-1", stalwartQueueId: "qid-A" }));
    await log.append(mkEntry({ id: "row-2", stalwartQueueId: "qid-B" }));
    const found = await log.findByStalwartQueueId("qid-B");
    expect(found?.id).toBe("row-2");
    expect(await log.findByStalwartQueueId("nope")).toBeNull();
  });

  it("truncates oversized subjects to 256 chars on append", async () => {
    const huge = "x".repeat(1000);
    await log.append(mkEntry({ id: "huge", subject: huge }));
    const back = await log.findById("huge");
    expect(back?.subject.length).toBe(256);
  });

  it("survives malformed lines on disk and skips them", async () => {
    // Simulate a partial write or hand-edit by writing the file directly
    // with a mix of valid and garbage lines. The log must still return
    // the valid rows rather than 500ing the admin endpoint.
    const good = JSON.stringify(mkEntry({ id: "good-1" }));
    const trailing = JSON.stringify(mkEntry({ id: "good-2" }));
    writeFileSync(
      path,
      good + "\n" + "{not json\n" + "\n" + trailing + "\n",
      "utf8",
    );
    const items = await log.read({ limit: 10, offset: 0 });
    expect(items.map((i) => i.id)).toEqual(["good-2", "good-1"]);
  });

  it("serialises concurrent appends so no rows are dropped", async () => {
    // Fire 20 appends without awaiting between them. The internal
    // promise chain should ensure all 20 land in the file.
    const promises: Promise<void>[] = [];
    for (let i = 0; i < 20; i++) {
      promises.push(log.append(mkEntry({ id: `c${i}` })));
    }
    await Promise.all(promises);
    expect(await log.count()).toBe(20);
  });

  afterEach(() => {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // ignore — best-effort tmp cleanup
    }
  });
});
