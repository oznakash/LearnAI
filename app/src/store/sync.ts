// Cross-device PlayerState sync against mem0's /v1/state endpoint.
//
// Server side (oznakash/mem0#8): one JSONB blob per user, keyed on the
// email claim of the session JWT. Auth via the same session JWT the SPA
// already uses for /v1/memories etc.
//
// Client side: load on sign-in, fire-and-forget save on every state
// change (debounced). Conflicts resolve via last-writer-wins. Naive but
// fits the threat model — a user is rarely on two devices writing
// simultaneously.
//
// What we sync vs. don't sync — see SYNCED_FIELDS below.

import type { PlayerState } from "../types";

const FETCH_TIMEOUT_MS = 8_000;

/**
 * Fields that travel to the server. Per-device identity, the session
 * token itself, and the demo-mode-only Client ID never sync.
 *
 *   identity            — re-derived from the session JWT each load
 *   serverSession       — per-device, never shared
 *   googleClientId      — demo-mode-only, per-browser
 *   apiKey/apiProvider  — per-browser secret, never leaves the device
 *
 * Everything else (profile, xp, focus, streak, badges, progress,
 * history, tasks, prefs, lastCalibrationAt, guildTier) is fair game.
 */
const SYNCED_FIELDS = [
  "profile",
  "xp",
  "focus",
  "focusUpdatedAt",
  "streak",
  "streakUpdatedAt",
  "badges",
  "guildTier",
  "progress",
  "history",
  "tasks",
  "lastCalibrationAt",
  "prefs",
  // Per-user cognition opt-out follows the user across devices: opt out
  // on a phone, sign in on a laptop, still opted out.
  "memoryOptOut",
] as const;

type SyncedField = (typeof SYNCED_FIELDS)[number];

export type SyncedPlayerState = Pick<PlayerState, SyncedField>;

export interface RemoteStateEnvelope {
  blob: Partial<SyncedPlayerState>;
  /** ISO timestamp from the server, or null for "no remote state yet". */
  updatedAt: string | null;
}

/** Strip per-device fields. The result is what we send up. */
export function pickSyncedFields(state: PlayerState): SyncedPlayerState {
  const out = {} as SyncedPlayerState;
  for (const k of SYNCED_FIELDS) {
    // Type-safe assignment via cast because Pick narrows but the loop is dynamic.
    (out as Record<string, unknown>)[k] = state[k];
  }
  return out;
}

/**
 * Apply the remote blob over the local state, keeping the per-device
 * fields intact. If the remote blob is empty (`{}`), the local state
 * stays as-is — useful for first-time signins where the server has
 * nothing yet.
 */
export function mergeRemoteIntoLocal(
  local: PlayerState,
  remote: Partial<SyncedPlayerState>
): PlayerState {
  if (!remote || Object.keys(remote).length === 0) return local;
  const next = { ...local };
  for (const k of SYNCED_FIELDS) {
    if (k in remote) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (next as any)[k] = (remote as any)[k];
    }
  }
  return next;
}

function trimTrailing(s: string): string {
  return s.replace(/\/+$/, "");
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = FETCH_TIMEOUT_MS
): Promise<Response> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctl.signal });
  } finally {
    clearTimeout(t);
  }
}

/** GET /v1/state. Returns null on any failure (caller falls back to local). */
export async function loadRemoteState(
  mem0Url: string,
  sessionToken: string
): Promise<RemoteStateEnvelope | null> {
  const base = trimTrailing(mem0Url);
  if (!base || !sessionToken) return null;
  try {
    const res = await fetchWithTimeout(`${base}/v1/state`, {
      method: "GET",
      headers: { authorization: `Bearer ${sessionToken}` },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { blob?: Partial<SyncedPlayerState>; updated_at?: string | null };
    return { blob: body.blob ?? {}, updatedAt: body.updated_at ?? null };
  } catch {
    return null;
  }
}

/** PUT /v1/state. Returns true on success. Silently fails on network/4xx. */
export async function saveRemoteState(
  mem0Url: string,
  sessionToken: string,
  blob: SyncedPlayerState
): Promise<boolean> {
  const base = trimTrailing(mem0Url);
  if (!base || !sessionToken) return false;
  try {
    const res = await fetchWithTimeout(`${base}/v1/state`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({ blob }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** DELETE /v1/state. Used by the "wipe everything" UX. */
export async function wipeRemoteState(
  mem0Url: string,
  sessionToken: string
): Promise<boolean> {
  const base = trimTrailing(mem0Url);
  if (!base || !sessionToken) return false;
  try {
    const res = await fetchWithTimeout(`${base}/v1/state`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${sessionToken}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}
