import type { GameTuning, ContentOverrides, AdminConfig, ServerAuthConfig } from "./types";
import type { Creator, CreatorId } from "../types";
import { DEFAULT_TUNING } from "./defaults";
import { SEED_CREATORS } from "../content/creators";
import { ADMIN_STORAGE_KEY } from "./store";

/**
 * Runtime accessors used by non-React code (e.g. game.ts) to read
 * tuning + content overrides without depending on the admin provider.
 * We read straight from localStorage and fall back to defaults — same
 * source of truth as the admin context.
 *
 * **Don't add memory-cognition decisions here.** The previous
 * `isOfflineMode()` / `getRuntimeMemoryConfig()` lived in this file and
 * caused a race: MemoryContext's `useMemo` saw new React state but
 * runtime cache hadn't caught up to localStorage yet, so the SPA
 * silently fell back to OfflineMemoryService. Memory wiring now flows
 * from React state directly via `MemoryProvider` → `selectMemoryService(opts)`.
 */

let cachedRaw: string | null = null;
let cachedParsed: Partial<AdminConfig> | null = null;

function readAdminConfig(): Partial<AdminConfig> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ADMIN_STORAGE_KEY);
    if (raw === cachedRaw) return cachedParsed;
    cachedRaw = raw;
    cachedParsed = raw ? (JSON.parse(raw) as Partial<AdminConfig>) : null;
    return cachedParsed;
  } catch {
    return null;
  }
}

export function getRuntimeTuning(): GameTuning {
  const cfg = readAdminConfig();
  if (!cfg?.tuning) return DEFAULT_TUNING;
  return {
    ...DEFAULT_TUNING,
    ...cfg.tuning,
    xp: { ...DEFAULT_TUNING.xp, ...(cfg.tuning.xp ?? {}) },
    focus: { ...DEFAULT_TUNING.focus, ...(cfg.tuning.focus ?? {}) },
    tiers: { ...DEFAULT_TUNING.tiers, ...(cfg.tuning.tiers ?? {}) },
  };
}

export function getRuntimeContentOverrides(): ContentOverrides {
  const cfg = readAdminConfig();
  if (!cfg?.contentOverrides) return { topics: {}, extras: [] };
  return {
    topics: cfg.contentOverrides.topics ?? {},
    extras: cfg.contentOverrides.extras ?? [],
  };
}

export function getRuntimeServerAuth(): ServerAuthConfig {
  const cfg = readAdminConfig();
  const fallback: ServerAuthConfig = { mode: "demo", googleClientId: "", mem0Url: "" };
  if (!cfg?.serverAuth) return fallback;
  return { ...fallback, ...cfg.serverAuth };
}

export function isServerAuthProduction(): boolean {
  return getRuntimeServerAuth().mode === "production";
}

/**
 * Whether the Lenny's Podcast content seam is enabled. Default `true` (the
 * seed nuggets ship as part of the curriculum). Operators flip this off in
 * Admin → Config → Feature flags. The topic loader (`content/index.ts`)
 * checks this and strips every PodcastNugget Spark when false.
 */
export function isLennyContentEnabled(): boolean {
  const cfg = readAdminConfig();
  // No saved config = default behaviour = ON.
  if (!cfg?.flags) return true;
  // Explicit false flips it off; anything else (true / undefined / missing)
  // keeps the default-ON behaviour.
  return cfg.flags.lennyContentEnabled !== false;
}

/**
 * Live creator registry. Merges seed creators (always present) with any
 * admin-saved creators (operator-added or operator-edited overrides).
 * Saved entries win on id collisions so the operator can rename / re-skin
 * a seed creator without losing the seed's id.
 */
export function getRuntimeCreators(): Record<CreatorId, Creator> {
  const cfg = readAdminConfig();
  const saved = (cfg?.creators ?? {}) as Record<CreatorId, Creator>;
  return { ...SEED_CREATORS, ...saved };
}

/** Look up a single creator by id. Returns undefined if unknown. */
export function getCreator(id: CreatorId | undefined): Creator | undefined {
  if (!id) return undefined;
  return getRuntimeCreators()[id];
}

/** For tests: clear the in-memory cache so localStorage changes are visible. */
export function _resetRuntimeCache() {
  cachedRaw = null;
  cachedParsed = null;
}
