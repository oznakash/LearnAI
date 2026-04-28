import type {
  MemoryAddInput,
  MemoryCategory,
  MemoryItem,
  MemoryService,
  MemoryStatus,
} from "./types";

/**
 * Self-hosted mem0 HTTP client. See `docs/mem0.md` for the architecture and
 * `docker-compose.mem0.yml` for how to stand up the server.
 *
 * Endpoint mapping (mem0 v1 REST surface):
 *   POST   /v1/memories/                 → add
 *   GET    /v1/memories/?user_id=…       → list
 *   POST   /v1/memories/search/          → search
 *   PUT    /v1/memories/<id>/            → update
 *   DELETE /v1/memories/<id>/            → forget
 *   DELETE /v1/memories/?user_id=…       → wipe
 *   GET    /health                       → health
 *
 * Tenancy: every request carries `user_id = <gmail-email>` (the Google
 * identity sub or, lacking that, the email address).
 */
export interface Mem0Options {
  serverUrl: string;
  apiKey?: string;
  userId: string;
  /** Per-call hard timeout in ms. Default 6000. */
  timeoutMs?: number;
}

interface RawMemory {
  id?: string;
  memory?: string;
  text?: string;
  metadata?: Record<string, unknown>;
  category?: MemoryCategory;
  created_at?: string | number;
  updated_at?: string | number;
}

export class Mem0MemoryService implements MemoryService {
  private readonly base: string;
  private readonly apiKey?: string;
  private readonly userId: string;
  private readonly timeoutMs: number;

  constructor(opts: Mem0Options) {
    this.base = trimTrailing(opts.serverUrl);
    this.apiKey = opts.apiKey;
    this.userId = opts.userId;
    this.timeoutMs = opts.timeoutMs ?? 6000;
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return {
      "content-type": "application/json",
      ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}),
      ...extra,
    };
  }

  private async fetchJson<T>(
    path: string,
    init: RequestInit & { timeoutMs?: number } = {}
  ): Promise<T> {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), init.timeoutMs ?? this.timeoutMs);
    try {
      const res = await fetch(`${this.base}${path}`, {
        ...init,
        signal: controller.signal,
        headers: { ...this.headers(), ...((init.headers as Record<string, string>) ?? {}) },
      });
      if (!res.ok) {
        let body = "";
        try {
          body = await res.text();
        } catch {
          /* ignore */
        }
        throw new Error(`mem0 ${path} → HTTP ${res.status} ${body}`.trim());
      }
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("application/json")) return undefined as unknown as T;
      return (await res.json()) as T;
    } finally {
      clearTimeout(t);
    }
  }

  private toItem(raw: RawMemory, fallback?: Partial<MemoryItem>): MemoryItem {
    const text = raw.memory ?? raw.text ?? fallback?.text ?? "";
    const created = numericTs(raw.created_at) ?? fallback?.createdAt ?? Date.now();
    const updated = numericTs(raw.updated_at) ?? fallback?.updatedAt ?? created;
    return {
      id: raw.id ?? fallback?.id ?? `m-${created}-${Math.random().toString(36).slice(2, 7)}`,
      text,
      metadata: raw.metadata ?? fallback?.metadata,
      category: raw.category ?? (raw.metadata?.category as MemoryCategory | undefined) ?? fallback?.category,
      createdAt: created,
      updatedAt: updated,
    };
  }

  async add(input: MemoryAddInput): Promise<MemoryItem> {
    const body = {
      messages: [{ role: "user", content: input.text }],
      user_id: this.userId,
      metadata: { ...(input.metadata ?? {}), category: input.category },
    };
    const raw = await this.fetchJson<RawMemory | { results?: RawMemory[] }>(
      "/v1/memories/",
      { method: "POST", body: JSON.stringify(body) }
    );
    const single = "results" in raw && Array.isArray(raw.results) ? raw.results[0] : (raw as RawMemory);
    return this.toItem(single ?? {}, { text: input.text, category: input.category, metadata: input.metadata });
  }

  async search(
    query: string,
    opts: { topK?: number; category?: MemoryCategory } = {}
  ): Promise<MemoryItem[]> {
    const body = {
      query,
      user_id: this.userId,
      limit: opts.topK ?? 5,
      filters: opts.category ? { category: opts.category } : undefined,
    };
    const raw = await this.fetchJson<{ results?: RawMemory[] } | RawMemory[]>(
      "/v1/memories/search/",
      { method: "POST", body: JSON.stringify(body) }
    );
    const items = Array.isArray(raw) ? raw : raw.results ?? [];
    return items.map((r) => this.toItem(r));
  }

  async list(
    opts: { category?: MemoryCategory; limit?: number } = {}
  ): Promise<MemoryItem[]> {
    const params = new URLSearchParams({ user_id: this.userId });
    if (opts.limit) params.set("limit", String(opts.limit));
    if (opts.category) params.set("category", opts.category);
    const raw = await this.fetchJson<{ results?: RawMemory[] } | RawMemory[]>(
      `/v1/memories/?${params.toString()}`
    );
    const items = Array.isArray(raw) ? raw : raw.results ?? [];
    return items.map((r) => this.toItem(r));
  }

  async update(
    id: string,
    patch: Partial<Pick<MemoryItem, "text" | "metadata" | "category">>
  ): Promise<MemoryItem> {
    const body: Record<string, unknown> = {};
    if (patch.text !== undefined) body.text = patch.text;
    if (patch.metadata !== undefined) body.metadata = patch.metadata;
    if (patch.category !== undefined) body.category = patch.category;
    const raw = await this.fetchJson<RawMemory>(`/v1/memories/${encodeURIComponent(id)}/`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    return this.toItem(raw, { id });
  }

  async forget(id: string): Promise<void> {
    await this.fetchJson(`/v1/memories/${encodeURIComponent(id)}/`, { method: "DELETE" });
  }

  async wipe(): Promise<void> {
    const params = new URLSearchParams({ user_id: this.userId });
    await this.fetchJson(`/v1/memories/?${params.toString()}`, { method: "DELETE" });
  }

  async health(): Promise<MemoryStatus> {
    try {
      const r = await this.fetchJson<{ status?: string; version?: string }>("/health", {
        timeoutMs: 2500,
      });
      return { ok: true, backend: "mem0", details: { ...(r ?? {}) } };
    } catch (e) {
      return { ok: false, backend: "mem0", reason: (e as Error).message };
    }
  }
}

function trimTrailing(s: string): string {
  return s.replace(/\/+$/, "");
}

function numericTs(v: string | number | undefined): number | undefined {
  if (v == null) return undefined;
  if (typeof v === "number") return v;
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : undefined;
}
