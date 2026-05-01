/**
 * Types for the cognition / memory layer. Implementations live next to this
 * file: `offline.ts` (no-op + localStorage stub) and `mem0.ts` (HTTP client
 * for a self-hosted mem0 server). The active impl is selected at runtime
 * by the offline flag in the admin config.
 *
 * The interface is intentionally narrow — six methods. Anything more clever
 * (knowledge graphs, agentic planning) lives behind it.
 */

export type MemoryCategory =
  | "goal"
  | "strength"
  | "gap"
  | "preference"
  | "history"
  | "calibration"
  | "system"
  /**
   * Vocabulary atoms the user has been exposed to and engaged with.
   * Written when the user taps a term inline in a Spark body (see
   * `docs/content-model.md` §2.4). The recommender reads this category
   * to:
   *   - skip inline-defining a term the user already engaged with,
   *   - bias toward Sparks that use vocab the user is *learning* (mid-
   *     mastery), away from vocab they've over-mastered.
   */
  | "vocabulary";

export interface MemoryItem {
  id: string;
  /** Human-readable. Always shown to the user as-is in the "Your Memory" tab. */
  text: string;
  /** Free-form structured data. Searchable, not directly shown. */
  metadata?: Record<string, unknown>;
  category?: MemoryCategory;
  createdAt: number;
  updatedAt: number;
}

export interface MemoryStatus {
  ok: boolean;
  backend: "offline" | "mem0";
  /** Optional human-readable reason when ok=false. */
  reason?: string;
  details?: Record<string, unknown>;
}

export interface MemoryAddInput {
  text: string;
  metadata?: Record<string, unknown>;
  category?: MemoryCategory;
}

export interface MemoryService {
  /** Add a new memory. Returns the stored item. */
  add(input: MemoryAddInput): Promise<MemoryItem>;
  /** Free-text retrieval. Returns top-k items relevant to `query`. */
  search(query: string, opts?: { topK?: number; category?: MemoryCategory }): Promise<MemoryItem[]>;
  /** List all memories (newest first). */
  list(opts?: { category?: MemoryCategory; limit?: number }): Promise<MemoryItem[]>;
  /** Update a memory's text / category / metadata. */
  update(id: string, patch: Partial<Pick<MemoryItem, "text" | "metadata" | "category">>): Promise<MemoryItem>;
  /** Delete a single memory. */
  forget(id: string): Promise<void>;
  /** Delete every memory the service holds for the current user. */
  wipe(): Promise<void>;
  /** Probe the underlying brain. */
  health(): Promise<MemoryStatus>;
}
