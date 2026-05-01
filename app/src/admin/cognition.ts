/**
 * Cohort cognition aggregator — client-side reduce over mem0's per-user
 * memories endpoint. Powers the new sections at the top of the Memory
 * tab (snapshot stats, engagement bars, struggle radar, live feed).
 *
 * Why client-side: at the current cohort size (single-digit users, ~60
 * memories total) one fan-out request per user costs less than the
 * round-trip of adding another mem0 endpoint and waiting for a deploy.
 * When the platform crosses ~50 users, swap this for a server-side
 * `GET /v1/memories/admin/stats` (TODO marked below) without changing
 * the consumers — they only see the `CohortCognition` shape.
 */
import type { TopicId } from "../types";

/** One memory row as returned by mem0's `/v1/memories/?user_id=…`
 *  LearnAI compat shim. */
export interface MemoryRow {
  id: string;
  memory: string;
  user_id: string;
  created_at?: string;
  updated_at?: string;
  metadata?: {
    category?: string;
    topicId?: string;
    levelId?: string;
    levelIndex?: number;
    sparkId?: string;
    sparkType?: string;
    correct?: boolean;
    [k: string]: unknown;
  };
}

export interface CohortCognition {
  /** Unique users that contributed at least one memory. */
  usersWithMemories: number;
  /** Of the cohort that signed up — even when their state is empty. */
  totalUsers: number;
  totalMemories: number;
  /** Whole-number average mems/user across users-with-memories. */
  avgMemoriesPerUser: number;
  /** Server-side most recent createdAt across the cohort, ms. */
  lastWriteAt: number | null;

  /** category → count, sorted desc by count. */
  byCategory: Array<{ key: string; n: number }>;
  /** topicId → count, sorted desc. */
  byTopic: Array<{ key: TopicId | string; n: number }>;
  /** sparkType → count, sorted desc. */
  bySparkType: Array<{ key: string; n: number }>;

  /** "Wrong on first try" memories — gold for product fixes. */
  struggle: MemoryRow[];

  /** Most-recent N memory writes across all users (privacy: emails kept,
   *  this is admin-only by definition). */
  recent: MemoryRow[];

  /** Per-user breakdown for the "who's silent / who's deep" view. */
  perUser: Array<{
    email: string;
    memories: number;
    lastWriteAt: number | null;
  }>;
}

interface FetchOpts {
  /** mem0 origin, no trailing slash. */
  base: string;
  /** Session JWT for the admin caller. */
  token: string;
  /** Cap of memories pulled per user. mem0 enforces its own ceiling on
   *  top of this — 200 is plenty for v1. */
  perUserLimit?: number;
}

async function fetchUserMemories(
  email: string,
  opts: FetchOpts,
  signal?: AbortSignal,
): Promise<MemoryRow[]> {
  const url = `${opts.base}/v1/memories/?user_id=${encodeURIComponent(email)}&limit=${opts.perUserLimit ?? 200}`;
  const r = await fetch(url, {
    headers: { authorization: `Bearer ${opts.token}` },
    signal,
  });
  if (!r.ok) {
    // Per-user 401/404/500 shouldn't poison the whole aggregate — return
    // empty so the rest of the cohort still surfaces.
    return [];
  }
  const body = (await r.json()) as MemoryRow[] | { results?: MemoryRow[] } | null;
  if (!body) return [];
  if (Array.isArray(body)) return body;
  if (Array.isArray(body.results)) return body.results;
  return [];
}

export interface BuildCohortInput {
  /** All real signed-up users from mem0's `/v1/state/admin/users`. */
  emails: string[];
  base: string;
  token: string;
  perUserLimit?: number;
  /** AbortSignal to cancel the fan-out on unmount. */
  signal?: AbortSignal;
}

/** Fan out one request per user in the cohort, then reduce. Order of
 *  results is not stable across runs since fetches race, but the reduce
 *  output is deterministic. */
export async function buildCohortCognition(
  input: BuildCohortInput,
): Promise<CohortCognition> {
  const { emails, base, token, perUserLimit, signal } = input;
  const totalUsers = emails.length;

  const fetches = emails.map((e) =>
    fetchUserMemories(e, { base, token, perUserLimit }, signal).then(
      (rows) => ({ email: e, rows }),
    ),
  );
  const settled = await Promise.all(fetches);

  const all: MemoryRow[] = [];
  for (const { rows } of settled) {
    for (const r of rows) all.push(r);
  }

  // Aggregate. We hit a hot path on every refresh — keep it linear.
  const cat = new Map<string, number>();
  const topic = new Map<string, number>();
  const sparkType = new Map<string, number>();
  const struggle: MemoryRow[] = [];
  let lastWriteAt: number | null = null;

  for (const m of all) {
    const md = m.metadata ?? {};
    const c = (md.category ?? "(none)") as string;
    cat.set(c, (cat.get(c) ?? 0) + 1);
    if (md.topicId) topic.set(md.topicId, (topic.get(md.topicId) ?? 0) + 1);
    if (md.sparkType) sparkType.set(md.sparkType, (sparkType.get(md.sparkType) ?? 0) + 1);
    if (md.correct === false) struggle.push(m);
    if (m.created_at) {
      const ts = Date.parse(m.created_at);
      if (!Number.isNaN(ts) && (lastWriteAt === null || ts > lastWriteAt)) {
        lastWriteAt = ts;
      }
    }
  }

  const sortedDesc = (m: Map<string, number>) =>
    Array.from(m.entries())
      .map(([key, n]) => ({ key, n }))
      .sort((a, b) => b.n - a.n);

  const recent = [...all]
    .sort((a, b) => Date.parse(b.created_at ?? "") - Date.parse(a.created_at ?? ""))
    .slice(0, 25);

  const perUser = settled
    .map(({ email, rows }) => {
      const last = rows.reduce<number | null>((acc, r) => {
        const ts = r.created_at ? Date.parse(r.created_at) : NaN;
        if (!Number.isFinite(ts)) return acc;
        return acc === null || ts > acc ? ts : acc;
      }, null);
      return { email, memories: rows.length, lastWriteAt: last };
    })
    .sort((a, b) => b.memories - a.memories);

  const usersWithMemories = perUser.filter((u) => u.memories > 0).length;
  const avg = usersWithMemories === 0 ? 0 : Math.round(all.length / usersWithMemories);

  return {
    usersWithMemories,
    totalUsers,
    totalMemories: all.length,
    avgMemoriesPerUser: avg,
    lastWriteAt,
    byCategory: sortedDesc(cat),
    byTopic: sortedDesc(topic),
    bySparkType: sortedDesc(sparkType),
    struggle: struggle
      .sort((a, b) => Date.parse(b.created_at ?? "") - Date.parse(a.created_at ?? ""))
      .slice(0, 20),
    recent,
    perUser,
  };
}

/** Format a memory.created_at into a compact "5m ago / 2h ago / 3d ago" label. */
export function relativeTime(ts: number | null, now = Date.now()): string {
  if (ts === null) return "—";
  const diff = now - ts;
  if (diff < 0) return "just now";
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  if (day < 30) return `${Math.floor(day / 7)}w ago`;
  return `${Math.floor(day / 30)}mo ago`;
}
