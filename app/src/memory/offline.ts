import type {
  MemoryAddInput,
  MemoryCategory,
  MemoryItem,
  MemoryService,
  MemoryStatus,
} from "./types";

/**
 * Offline memory service — no remote brain. Stores per-user memories in
 * `localStorage` and performs naive substring + recency search.
 *
 * Used when:
 *  - the admin has `flags.offlineMode = true` (default), or
 *  - the cognition layer is configured but the mem0 server is unreachable
 *    (we degrade silently into this).
 *
 * The point isn't to be smart — it's to keep the *read-write parity* ethic
 * (the player can always inspect what the system knows about them) intact
 * even when there's no remote brain.
 */
export class OfflineMemoryService implements MemoryService {
  private readonly userKey: string;

  constructor(userKey: string) {
    this.userKey = userKey || "anon";
  }

  private storageKey(): string {
    return `builderquest:memory:offline:${this.userKey}`;
  }

  private read(): MemoryItem[] {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(this.storageKey());
      return raw ? (JSON.parse(raw) as MemoryItem[]) : [];
    } catch {
      return [];
    }
  }

  private write(items: MemoryItem[]) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(this.storageKey(), JSON.stringify(items));
  }

  async add(input: MemoryAddInput): Promise<MemoryItem> {
    const now = Date.now();
    const item: MemoryItem = {
      id: `m-${now}-${Math.random().toString(36).slice(2, 7)}`,
      text: input.text,
      metadata: input.metadata,
      category: input.category,
      createdAt: now,
      updatedAt: now,
    };
    const items = this.read();
    this.write([item, ...items].slice(0, 500));
    return item;
  }

  async search(
    query: string,
    opts: { topK?: number; category?: MemoryCategory } = {}
  ): Promise<MemoryItem[]> {
    const k = opts.topK ?? 5;
    const q = query.toLowerCase().trim();
    let items = this.read();
    if (opts.category) items = items.filter((i) => i.category === opts.category);
    if (!q) return items.slice(0, k);
    const scored = items.map((i) => {
      const text = (i.text ?? "").toLowerCase();
      let score = 0;
      if (text.includes(q)) score += 10;
      // small bonus for shared tokens
      const qTokens = new Set(q.split(/\W+/).filter(Boolean));
      for (const tok of qTokens) if (tok && text.includes(tok)) score += 1;
      // recency bonus (more recent = more relevant)
      score += Math.max(0, 5 - Math.floor((Date.now() - i.updatedAt) / (1000 * 60 * 60 * 24)));
      return { i, score };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored
      .filter((s) => s.score > 0)
      .slice(0, k)
      .map((s) => s.i);
  }

  async list(
    opts: { category?: MemoryCategory; limit?: number } = {}
  ): Promise<MemoryItem[]> {
    let items = this.read();
    if (opts.category) items = items.filter((i) => i.category === opts.category);
    return items.slice(0, opts.limit ?? items.length);
  }

  async update(
    id: string,
    patch: Partial<Pick<MemoryItem, "text" | "metadata" | "category">>
  ): Promise<MemoryItem> {
    const items = this.read();
    const idx = items.findIndex((i) => i.id === id);
    if (idx === -1) throw new Error(`Memory not found: ${id}`);
    const next: MemoryItem = {
      ...items[idx],
      ...patch,
      updatedAt: Date.now(),
    };
    items[idx] = next;
    this.write(items);
    return next;
  }

  async forget(id: string): Promise<void> {
    this.write(this.read().filter((i) => i.id !== id));
  }

  async wipe(): Promise<void> {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(this.storageKey());
  }

  async health(): Promise<MemoryStatus> {
    return { ok: true, backend: "offline" };
  }
}
