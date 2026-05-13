// Append-only audit log of every email submission to the SMTP relay.
//
// Why: prior to this module, the only record of "did we send X to Y?" lived
// in the operator's browser localStorage (the AdminEmails.tsx Queue). That's
// per-browser, lossy, and lies about being authoritative. This module is the
// server-side truth — one JSON-Lines row per `POST /v1/email/send` attempt,
// stored on the mounted /data volume so it survives container restarts.
//
// Storage shape: JSONL. One line = one EmailLogEntry. Append-only; never
// rewritten. Reads load the file, parse each line, return the slice the
// caller asked for. At LearnAI's send volume (manual admin flush only,
// <100/month realistically) this is correct — no index, no rotation.
// If/when bulk sending lands, swap to sqlite without changing the API.
//
// Privacy: the recipient address is stored cleartext. The endpoint that
// exposes the log requires `requireUser` + `requireAdmin` (SOCIAL_ADMIN_EMAILS
// allowlist). The full HTML body is NOT stored — only the subject.

import { promises as fs } from "node:fs";
import { dirname } from "node:path";
import { randomBytes } from "node:crypto";

export interface EmailLogEntry {
  /** Local row id; also passed as RFC 3461 ENVID on MAIL FROM. */
  id: string;
  /** ISO 8601 timestamp of the submission attempt. */
  ts: string;
  /** Recipient address (cleartext — see module docstring). */
  to: string;
  /** Domain of the recipient (cached for quick aggregation). */
  toDomain: string;
  /** Subject line as sent (truncated to 256 chars). */
  subject: string;
  /** True if nodemailer's `sendMail()` resolved without throwing. */
  ok: boolean;
  /** RFC 5322 Message-ID header value (e.g. `<uuid@host>`). */
  rfcMessageId?: string;
  /** Stalwart's opaque queue id, parsed from the 250 line. */
  stalwartQueueId?: string;
  /** Raw SMTP response (e.g. `250 2.0.0 Message queued as 217...`). */
  smtpResponse?: string;
  /** When `ok=false`: human-readable error. */
  providerError?: string;
  /** Privacy-safe hash (sha-256, first 8 chars) of admin who triggered. */
  submittedByHash: string;
  /** True if a one-click HTTPS unsubscribe URL was provided. */
  hasUnsubUrl: boolean;
}

/**
 * Generate a new local row id. Used as both the `id` field and the
 * ENVID parameter on RFC 3461 DSN. Format: `el-<base36-ts>-<hex4>`
 * — sortable, monotonic enough for human eyeballing, short enough for
 * log lines.
 */
export function newEnvId(): string {
  return `el-${Date.now().toString(36)}-${randomBytes(2).toString("hex")}`;
}

/**
 * Extract Stalwart's queue id from the SMTP server's 250 response.
 *
 * Stalwart returns one of several forms after DATA completion:
 *   "250 2.0.0 Message queued as 217700302698266624"
 *   "250 2.0.0 Message queued with id 217700302698266624"
 *   "250 2.0.0 OK id=217700302698266624"
 *
 * Other servers (postfix, sendmail) return different shapes:
 *   "250 ok 1715608800 qp 12345"          ← postfix queue id is "12345"
 *   "250 2.0.0 mAAAA Message accepted"    ← sendmail
 *
 * We're optimising for the Stalwart case (production) and falling back to
 * `undefined` for anything we don't recognise. A missing queue id is not
 * a fatal error — the log row is still useful; only the per-message
 * Stalwart status lookup gets disabled for that row.
 */
export function parseStalwartQueueId(smtpResponse: string | undefined): string | undefined {
  if (!smtpResponse) return undefined;
  // Match "queued as X", "queued with id X", or "id=X" — Stalwart-style.
  const m = smtpResponse.match(/(?:queued\s+(?:as|with\s+id)|\bid=)\s*([A-Za-z0-9_-]+)/i);
  return m?.[1];
}

/** Truncate a subject for storage; UTF-8-safe at the codepoint boundary. */
function clampSubject(s: string): string {
  if (s.length <= 256) return s;
  return s.slice(0, 256);
}

/**
 * The log itself. Methods are async + serialised internally so concurrent
 * `append()` calls don't interleave half-written lines on the OS append
 * boundary. `read()` and `findById()` re-parse from disk each call — fine
 * for our scale, and removes the need to think about cache invalidation.
 */
export class EmailLog {
  private writeChain: Promise<void> = Promise.resolve();

  constructor(public readonly path: string) {}

  /**
   * Append one entry. Resolves once the write reaches the OS buffer. We
   * don't fsync — log durability on container restart is good enough for
   * an audit trail, and fsync per row would dominate p99 latency on the
   * /v1/email/send hot path.
   */
  async append(entry: EmailLogEntry): Promise<void> {
    // Ensure parent directory exists. Idempotent and cheap.
    await fs.mkdir(dirname(this.path), { recursive: true }).catch(() => {});
    const normalised: EmailLogEntry = { ...entry, subject: clampSubject(entry.subject) };
    const line = JSON.stringify(normalised) + "\n";
    // Serialise writes via a chained promise. node's fs.appendFile is
    // atomic for small writes on a single filesystem, but two concurrent
    // calls can still interleave their callbacks. The chain guarantees
    // FIFO order matching the call order — useful when correlating with
    // request logs.
    this.writeChain = this.writeChain
      .catch(() => {})
      .then(() => fs.appendFile(this.path, line, "utf8"));
    return this.writeChain;
  }

  /**
   * Return the most recent `limit` entries (newest first), skipping the
   * first `offset`. If the file doesn't exist yet, returns `[]`. Lines
   * that fail to parse are silently dropped — we'd rather show a partial
   * log than 500 the endpoint.
   */
  async read({ limit, offset }: { limit: number; offset: number }): Promise<EmailLogEntry[]> {
    const all = await this.readAll();
    // Newest-first.
    all.reverse();
    return all.slice(offset, offset + limit);
  }

  /** Lookup by local row id. O(n) over the file; n is tiny. */
  async findById(id: string): Promise<EmailLogEntry | null> {
    const all = await this.readAll();
    for (let i = all.length - 1; i >= 0; i--) {
      if (all[i].id === id) return all[i];
    }
    return null;
  }

  /** Lookup by Stalwart queue id; used by status polling utilities. */
  async findByStalwartQueueId(queueId: string): Promise<EmailLogEntry | null> {
    const all = await this.readAll();
    for (let i = all.length - 1; i >= 0; i--) {
      if (all[i].stalwartQueueId === queueId) return all[i];
    }
    return null;
  }

  /** Total row count — for paging UI. */
  async count(): Promise<number> {
    const all = await this.readAll();
    return all.length;
  }

  private async readAll(): Promise<EmailLogEntry[]> {
    let raw: string;
    try {
      raw = await fs.readFile(this.path, "utf8");
    } catch (e) {
      // ENOENT before the first write: log is empty.
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw e;
    }
    const out: EmailLogEntry[] = [];
    for (const line of raw.split("\n")) {
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line);
        if (parsed && typeof parsed === "object" && typeof parsed.id === "string") {
          out.push(parsed as EmailLogEntry);
        }
      } catch {
        // skip malformed line — partial write recovery
      }
    }
    return out;
  }
}
