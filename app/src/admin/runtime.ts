import type { GameTuning, ContentOverrides, AdminConfig, MemoryConfig } from "./types";
import { DEFAULT_TUNING } from "./defaults";
import { ADMIN_STORAGE_KEY } from "./store";

/**
 * Runtime accessors used by non-admin code (e.g. game.ts) to read tuning
 * + content overrides without taking a hard dependency on the admin
 * provider.  We read straight from localStorage and fall back to defaults
 * — same source of truth as the admin context.
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

/** Returns true when the admin has the cognition layer turned off. */
export function isOfflineMode(): boolean {
  const cfg = readAdminConfig();
  // Default to true (offline) when admin config hasn't been initialized yet —
  // matches `defaultAdminConfig`, keeps the zero-infra path safe.
  return cfg?.flags?.offlineMode ?? true;
}

export function getRuntimeMemoryConfig(): MemoryConfig {
  const cfg = readAdminConfig();
  const fallback: MemoryConfig = { serverUrl: "", apiKey: "", perUserDailyCap: 200 };
  if (!cfg?.memoryConfig) return fallback;
  return { ...fallback, ...cfg.memoryConfig };
}

/** For tests: clear the in-memory cache so localStorage changes are visible. */
export function _resetRuntimeCache() {
  cachedRaw = null;
  cachedParsed = null;
}
