# BuilderQuest — Technical implementation: offline flag + mem0 layer

> Sister docs: [`ux.md`](./ux.md), [`mem0.md`](./mem0.md).
>
> This document is what an engineer needs to ship the work. It pins down the
> shapes, the wiring, the failure modes, the rollout, and the tests.

## 1. Mental model in one paragraph

BuilderQuest today is a pure SPA backed by `localStorage`. We're adding a thin
**MemoryService** abstraction with two interchangeable implementations: an
**offline** (no-op + local-only) one, and a **mem0** one that talks to a
self-hosted mem0 server. A single **`offlineMode`** flag in the admin config
selects which implementation is active. Every memory-related code path goes
through `MemoryService` so the rest of the app never knows which backend is in
use.

## 2. Offline-mode flag

### 2.1 Where it lives

`AdminConfig.flags.offlineMode: boolean` (extends the existing `FeatureFlags`
type). Stored in `localStorage` under `builderquest:admin:v1`, surfaced through
the `useAdmin()` hook, **and** through a synchronous read in
`admin/runtime.ts` (so non-React code paths can consult it cheaply).

```ts
// admin/types.ts
export interface FeatureFlags {
  // …existing flags…
  offlineMode: boolean;     // master switch for the cognition layer
  memoryPlayerOptIn: boolean; // if true, players can override the global flag
}
```

### 2.2 Default

`offlineMode: true` in the default config. The local-only experience is what
ships out of the box; admins explicitly turn cognition on. This makes the
zero-infra path the default and avoids surprising the player with a network
dependency.

### 2.3 Where it's read

- `MemoryProvider` → at every `MemoryService.getActive()` call. If the flag
  flipped, the provider returns a different impl on the next call (no reload).
- The TopBar reads it to decide whether to show the *"📴 Offline mode"* badge.
- `Onboarding` skips the "memory will start remembering" card when offline.
- `AdminPromptStudio` and `AdminContent` work identically in either mode.

### 2.4 Toggle UX (admin)

`AdminConfigTab` already has a flags grid. We add `offlineMode` with a
prominent banner: *"Cognition layer is OFF. BuilderQuest works exactly like
v1 — pure localStorage, no remote brain."* When toggled OFF (i.e. *cognition
on*), the banner becomes *"Cognition layer is ON. mem0 server: <url>. Health:
✅"* with an inline ping check.

### 2.5 What changes when offline is ON

| Path | Online (cognition on) | Offline |
|---|---|---|
| Spark complete | Write episodic memory → mem0 | No-op |
| Profile change | Write profile-shaped facts to mem0 | No-op |
| Calibration | Write a calibration result memory | No-op |
| Home recommendation | Hybrid: heuristic + memory query | Heuristic only |
| In-session nudge | Memory query | Skipped |
| "Your Memory" tab | Live mem0 data | Empty state |
| Dynamic content generation (Settings → API key) | Works (player's own LLM key) | Works (unchanged) |
| Email send | Unchanged | Unchanged |

The flag never blocks the *seed curriculum*, the static game loop, the email
provider, or anything else. It only gates the cognition + memory paths.

## 3. The `MemoryService` interface

Single, narrow surface. Implementations: `OfflineMemoryService` (default),
`Mem0MemoryService`.

```ts
// app/src/memory/types.ts
export interface MemoryItem {
  id: string;
  text: string;             // human-readable
  metadata?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
  category?:                // optional shape-tag, used by the UI
    | "goal"
    | "strength"
    | "gap"
    | "preference"
    | "history"
    | "calibration"
    | "system";
}

export interface MemoryService {
  /** Add or update a memory. Returns the stored item. */
  add(input: { text: string; metadata?: Record<string, unknown>; category?: MemoryItem["category"] }): Promise<MemoryItem>;
  /** Free-text retrieval (semantic). Returns top-k. */
  search(query: string, opts?: { topK?: number; category?: MemoryItem["category"] }): Promise<MemoryItem[]>;
  /** List all memories for the current user. */
  list(opts?: { category?: MemoryItem["category"]; limit?: number }): Promise<MemoryItem[]>;
  /** Update a memory's text. */
  update(id: string, patch: Partial<Pick<MemoryItem, "text" | "metadata" | "category">>): Promise<MemoryItem>;
  /** Forget a single memory. */
  forget(id: string): Promise<void>;
  /** Forget everything for this user. */
  wipe(): Promise<void>;
  /** Health probe. Returns ok=true if the underlying brain is healthy. */
  health(): Promise<{ ok: boolean; backend: "offline" | "mem0"; details?: Record<string, unknown> }>;
}
```

### 3.1 The active service

Resolved at the React-tree boundary by `MemoryProvider` and via a vanilla JS
`getMemoryService()` for non-React paths. Resolution rule:

```
if AdminConfig.flags.offlineMode === true → OfflineMemoryService
else if AdminConfig.memoryConfig.serverUrl is empty → OfflineMemoryService (degrade)
else → Mem0MemoryService (configured to that URL + apiKey + currentUserEmail)
```

Implementations live in `app/src/memory/{offline.ts,mem0.ts,index.ts}`.

### 3.2 `OfflineMemoryService`

- `add` / `update` / `forget` / `wipe` / `list` / `search` operate on a small
  per-user namespace inside `localStorage`. Not used to derive insights —
  but it keeps the "Your Memory" tab from looking dead in offline mode.
- `search` uses a simple substring + recency sort (no embeddings).
- `health()` always returns `{ ok: true, backend: "offline" }`.

Why this isn't *just* a no-op: it gives offline players a transparent record of
the system's heuristics + their profile, which keeps the read-write parity
ethic intact even without a brain. Disabled via a sub-flag if we ever need.

### 3.3 `Mem0MemoryService`

Thin REST wrapper around mem0's HTTP API (see [`mem0.md`](./mem0.md) §4 for
endpoint mapping). Handles:

- `Authorization: Bearer <key>` header.
- `user_id = <gmail-email>` on every call (mem0's tenancy primitive).
- 6-second timeout per call. Failures bubble up to a higher-level
  `withMemoryGuard()` helper that catches, logs, and degrades to *"pause"* mode.
- Local outbox queue (capped at 100 entries, 30-min TTL) for `add` calls when
  the server is unreachable; flushed on the next successful health call.

### 3.4 What we *write* — the event taxonomy

| When | Category | Example text | Metadata |
|---|---|---|---|
| Profile created (post-onboarding) | `goal` / `preference` | *"Goal: ship a RAG demo"* | `{ source: "onboarding" }` |
| Spark answered correctly 3× in a row in a topic | `strength` | *"Confident on RAG basics"* | `{ topicId, level }` |
| Spark answered incorrectly 2× on same concept | `gap` | *"Struggles with attention vs context"* | `{ topicId, level, conceptKey }` |
| Boss Cell passed | `history` | *"Beat AI Foundations Boss Cell L10"* | `{ topicId, score }` |
| Calibration finished | `calibration` | *"Recalibrated to architect; weak on safety"* | `{ score }` |
| Player edits a memory | (preserved) | (their text) | `{ source: "user-edit" }` |
| Player explicitly tells the assistant something | `preference` | *"Prefers vendor-neutral examples"* | `{ source: "user-stated" }` |

Writes are **fire-and-forget**: the React event handler does its job
immediately and dispatches the memory write to a low-priority queue. The
critical path (next Spark, next screen) must never wait on a memory write.

### 3.5 What we *read* — the query taxonomy

| Where | Query | Top-k |
|---|---|---|
| Home "Today, for you" card | *"What does this user want to learn next?"* | 3 |
| In-session nudge | *"What pattern did this user just demonstrate?"* | 1 |
| Recalibration preamble | *"What has changed for this user lately?"* | 5 |
| Build Card personalization | *"What stack does this user use?"* | 2 |

Reads always have a hard 800 ms timeout. If the query times out, we silently
fall back to heuristics and write a `latency_breach` system memory.

### 3.6 What we will **not** store

Hard rules:

- **Never the player's API keys.** Anthropic/OpenAI keys remain in localStorage
  only.
- **Never raw chat content** beyond what the player explicitly typed (we only
  summarize-and-store conclusions).
- **Never PII beyond email + first-name.** No location, no IP, no device.
- **Never another user's data** — single-tenant memories per Gmail.
- **Never the seed curriculum.** Topics + levels live in code (and the admin
  Content overrides), not in mem0.
- **Never the email queue, SMTP creds, or Google OAuth client ID.** Admin
  config stays in localStorage on the admin's device.

## 4. Wiring map (where each call lands)

```
PlayerProvider               – owns identity + game state + tasks
└─ MemoryProvider (NEW)      – injects MemoryService into the tree, handles
   │                           offline-flag flip, runs the local outbox.
   ├─ Onboarding             – on profile created → addMany(profileFacts)
   ├─ Calibration            – on result → add(calibrationFact)
   ├─ Play                   – after every Spark → addEpisodic(spark, correct)
   │                           every Nth Spark → search(nudge query)
   ├─ Home                   – on mount → search(today query) → fallback heuristic
   ├─ TopicView              – on mount → search(topic query) → adjust suggestion
   └─ Settings → "Your Memory" – list + edit + wipe
AdminProvider                – owns AdminConfig
└─ AdminConsole
   └─ AdminMemory (NEW tab)  – server URL + key + offline toggle + per-user inspector
```

## 5. Configuration shape

Add to `AdminConfig`:

```ts
export interface MemoryConfig {
  serverUrl: string;            // e.g. https://mem0.builderquest.app
  apiKey?: string;              // bearer token
  perUserDailyCap: number;      // default 200 writes/day; 0 = unlimited
  retentionDays?: number;       // default undefined = keep forever
}

export interface AdminConfig {
  // …existing…
  flags: FeatureFlags;          // now includes offlineMode + memoryPlayerOptIn
  memoryConfig: MemoryConfig;
}
```

`memoryConfig.serverUrl` empty + flag online ⇒ degrade silently to offline; show
banner in admin nudging the admin to configure.

## 6. Failure / pause modes

| Failure | Behavior | UX badge |
|---|---|---|
| `offlineMode = true` | Use OfflineMemoryService | 📴 Offline mode |
| Online but `serverUrl` empty | Degrade to OfflineMemoryService | ⚪ Memory not configured |
| Server unreachable for > 1 health probe | Pause; queue writes; retry every 30s | 🟡 Memory pause |
| Server returns 401 | Pause; show admin a "rotate key" toast | 🔴 Auth failed |
| Per-user daily cap exceeded | Reads work; writes drop with a counter | 🟠 Cap reached |

All status flows through a single `useMemoryStatus()` hook so the badge logic
is in one place.

## 7. Performance budget

- `search()` 95p < 600 ms.
- `add()` is async-fire-and-forget; never blocks UI.
- Outbox flush on reconnect ≤ 5 calls/sec to avoid hammering the server.
- Admin per-user inspector caps at 500 returned memories.
- Caches: a 60-second TTL `lru` cache for the most recent search results.

## 8. Tests we'll add (minimum)

| Suite | What it locks in |
|---|---|
| `__tests__/memory.offline.test.ts` | Offline impl: add → list → forget → wipe round-trip |
| `__tests__/memory.mem0.test.ts` | mem0 impl: mocks `fetch`; verifies URL, headers, payload, error surface |
| `__tests__/memory.guard.test.ts` | `withMemoryGuard()` falls back without throwing on 5xx / timeout |
| `__tests__/admin.flags.offline.test.ts` | Toggling `offlineMode` swaps which service is active |
| `__tests__/play.memory.test.tsx` | Completing a Spark fires `add()` exactly once; spam-clicks still don't double-fire |
| `__tests__/home.memory.test.tsx` | Home renders heuristic copy when no memory available |

## 9. Rollout plan

1. **Phase 0 (this PR):** docs + offline-mode flag + MemoryService skeleton +
   `OfflineMemoryService` working end-to-end + Mem0 client behind the flag,
   stub'd to success-but-unused. Ship.
2. **Phase 1:** Stand up the self-hosted mem0 (docker-compose, see
   [`mem0.md`](./mem0.md) §6). Wire `Onboarding → addProfileFacts`. First
   real "remembered fact" appears in "Your Memory".
3. **Phase 2:** `Spark → addEpisodic`. The 3-correct-in-a-row → strength
   memory. Per-user cap enforced.
4. **Phase 3:** Read paths (Home, Recalibration, Build Card personalization).
5. **Phase 4:** Telemetry + dashboard for accept/dismiss + wipe rate.

## 10. Reverse path — disabling cognition cleanly

If we ever need to roll back: flip `offlineMode → true` in admin. **The next
session uses OfflineMemoryService.** mem0 server keeps running; data is not
lost. Re-enable later → user sees their memories again. Full kill switch in
under 60 seconds.
