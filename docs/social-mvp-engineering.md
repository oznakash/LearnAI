# Social MVP — Engineering Plan

> _Sister doc to [`social-mvp-product.md`](./social-mvp-product.md). Same scope, told from the CTO chair: services, schemas, types, wiring, tests, rollout._
>
> Anchored to: [`architecture.md`](./architecture.md) (the structural change this realizes), [`technical.md`](./technical.md) (the engineering style we follow), [`mem0.md`](./mem0.md) (the precedent for "thin client + self-hosted backend"), the existing `app/src/` codebase.

---

## 1. Mental model in one paragraph

We're adding a second self-hosted backend that mirrors the **shape** of how we shipped mem0: thin client in the SPA, narrow service interface, decoupled storage, optional + flag-gated, fork-friendly. The cognition layer (mem0) stays exactly as it is — private, per-Gmail. The new **Social Graph Service** is its sibling: public-shaped data only (profiles, tune-ins, blocks, reports, Signals, Stream events), in its own Postgres, behind a tiny **auth-verifying proxy** that verifies a Google ID token, injects `userEmail`, rate-limits, and forwards. The SPA gets a new `SocialService` interface (offline impl + HTTP impl) wrapped in a React provider that mirrors `MemoryContext`. Five new player views (Profile, SparkStream, Network) and three upgraded views (Leaderboard → Boards, Settings, Home, TopicView), one new admin tab (Moderation). One PR.

---

## 2. The shape: what we are building (in code), at a glance

```
┌──────────────────────────────────────────────────────────────────┐
│  SPA (React + Vite)                                                │
│                                                                    │
│   ┌──────────────────┐  ┌──────────────────┐  ┌────────────────┐   │
│   │ PlayerProvider    │  │ MemoryProvider    │  │ SocialProvider │   │
│   │  (existing)       │  │  (existing)       │  │  ★ new          │   │
│   └──────────────────┘  └──────────────────┘  └────────────────┘   │
│       │                      │                       │              │
│       ▼                      ▼                       ▼              │
│   localStorage           mem0 HTTP                Social HTTP       │
└──────────────────────────────────────────────────────────────────┘
                                                  │
                                                  ▼
                    ┌────────────────────────────────────────────┐
                    │  Auth-verifying proxy (Cloudflare Worker)   │
                    │   • verifies Google ID token                │
                    │   • injects user_email                      │
                    │   • rate-limits per email                   │
                    │   • forwards to mem0 OR social-svc          │
                    └──────────┬─────────────────────────────────┘
                               │                        │
                       ┌───────▼─────────┐      ┌───────▼─────────┐
                       │ mem0 server      │      │ social-svc      │
                       │ (existing)       │      │ ★ new           │
                       │ + Postgres-1     │      │ + Postgres-2    │
                       └──────────────────┘      └──────────────────┘
```

Two new boxes ship in this PR: `social-svc` and the `auth-verifying proxy`. The proxy was already on the Sprint-2 roadmap; we cash it in here. Both are small (proxy ~80 LOC; social-svc ~1.5k LOC, single binary).

---

## 3. Data model — Postgres-2 schema

Owned by `social-svc`. Versioned with `node-pg-migrate`. Initial migration: `001_init.sql`.

### 3.1 Tables

```sql
-- 3.1.1 Identity surface (one row per signed-in player)
CREATE TABLE profiles (
  email           CITEXT PRIMARY KEY,                -- Gmail; canonical id everywhere
  handle          CITEXT UNIQUE NOT NULL,            -- e.g. "maya", "maya2"
  display_first   TEXT NOT NULL,                     -- first name only by default
  display_full    TEXT,                              -- nullable; only set if user opts in
  picture_url     TEXT,                              -- google identity picture, optional
  age_band        TEXT NOT NULL CHECK (age_band IN ('kid','teen','adult')),
  profile_mode    TEXT NOT NULL DEFAULT 'open' CHECK (profile_mode IN ('open','closed')),
  show_full_name  BOOLEAN NOT NULL DEFAULT FALSE,
  show_current    BOOLEAN NOT NULL DEFAULT TRUE,
  show_map        BOOLEAN NOT NULL DEFAULT TRUE,
  show_activity   BOOLEAN NOT NULL DEFAULT TRUE,
  show_badges     BOOLEAN NOT NULL DEFAULT TRUE,
  show_signup     BOOLEAN NOT NULL DEFAULT TRUE,
  signals_galaxy  BOOLEAN NOT NULL DEFAULT TRUE,     -- show on Galaxy Board
  banned          BOOLEAN NOT NULL DEFAULT FALSE,
  banned_social   BOOLEAN NOT NULL DEFAULT FALSE,    -- banned from social only
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX profiles_handle_lower_idx ON profiles ((LOWER(handle)));

-- 3.1.2 Aggregated behavior (the public-safe projection of player progress).
-- Refreshed on a 60s cadence by social-svc from snapshots the SPA POSTs after
-- every Spark, Boss-pass, level-up, streak update. Snapshot endpoint is rate-
-- limited and idempotent (see §4.4).
CREATE TABLE profile_aggregates (
  email             CITEXT PRIMARY KEY REFERENCES profiles(email) ON DELETE CASCADE,
  xp_total          INTEGER NOT NULL DEFAULT 0,
  xp_week           INTEGER NOT NULL DEFAULT 0,
  xp_month          INTEGER NOT NULL DEFAULT 0,
  streak            INTEGER NOT NULL DEFAULT 0,
  guild_tier        TEXT    NOT NULL DEFAULT 'Builder',
  current_topic_id  TEXT,                           -- the Constellation they last touched
  current_level     INTEGER,                        -- the level they last reached
  badges            JSONB NOT NULL DEFAULT '[]'::jsonb, -- string ids
  topic_xp          JSONB NOT NULL DEFAULT '{}'::jsonb, -- { topicId: xp }
  activity_14d      JSONB NOT NULL DEFAULT '[]'::jsonb, -- 14 ints
  last_event_at     TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.1.3 Signals — topics this profile has opted into being discoverable for.
CREATE TABLE signals (
  email     CITEXT NOT NULL REFERENCES profiles(email) ON DELETE CASCADE,
  topic_id  TEXT   NOT NULL,
  added_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (email, topic_id)
);
-- Cap of 5 enforced in social-svc handler, not via constraint (so admin can bump).

-- 3.1.4 Tune-in graph — asymmetric directional edges.
-- An edge exists with status='approved' (Open profile) or 'pending' (Closed).
CREATE TABLE tune_ins (
  follower    CITEXT NOT NULL REFERENCES profiles(email) ON DELETE CASCADE,  -- the one tuning in
  target      CITEXT NOT NULL REFERENCES profiles(email) ON DELETE CASCADE,  -- the one being tuned in to
  status      TEXT   NOT NULL CHECK (status IN ('approved','pending')) DEFAULT 'approved',
  muted       BOOLEAN NOT NULL DEFAULT FALSE,                                -- follower muted target
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ,
  PRIMARY KEY (follower, target),
  CHECK (follower <> target)
);
CREATE INDEX tune_ins_target_idx ON tune_ins (target, status);
CREATE INDEX tune_ins_follower_idx ON tune_ins (follower, status);

-- 3.1.5 Blocks — symmetric ban between two profiles in either direction.
CREATE TABLE blocks (
  blocker     CITEXT NOT NULL REFERENCES profiles(email) ON DELETE CASCADE,
  blocked     CITEXT NOT NULL REFERENCES profiles(email) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker, blocked),
  CHECK (blocker <> blocked)
);
CREATE INDEX blocks_blocked_idx ON blocks (blocked);

-- 3.1.6 Reports — populate the AdminModeration queue.
CREATE TABLE reports (
  id          BIGSERIAL PRIMARY KEY,
  reporter    CITEXT REFERENCES profiles(email) ON DELETE SET NULL,
  reported    CITEXT NOT NULL REFERENCES profiles(email) ON DELETE CASCADE,
  reason      TEXT   NOT NULL CHECK (reason IN ('spam','harassment','off-topic','impersonation','other')),
  note        TEXT,                                   -- ≤280 chars
  context     JSONB NOT NULL DEFAULT '{}'::jsonb,     -- { kind: 'profile' | 'stream-card', cardId?, snapshot? }
  status      TEXT   NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','dismissed')),
  resolution  TEXT,                                   -- 'warned' | 'banned-social' | 'banned-global' | 'no-action'
  resolved_by CITEXT,                                 -- admin email
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);
CREATE INDEX reports_status_idx ON reports (status, created_at);

-- 3.1.7 Stream events — derived event log, used to render Spark Stream cards.
-- One row per event; we *do not* mutate. Cards are computed at read time.
CREATE TABLE stream_events (
  id          BIGSERIAL PRIMARY KEY,
  email       CITEXT NOT NULL REFERENCES profiles(email) ON DELETE CASCADE,
  kind        TEXT   NOT NULL CHECK (kind IN ('level_up','boss_beaten','streak_milestone','spotlight')),
  topic_id    TEXT,
  level       INTEGER,
  detail      JSONB NOT NULL DEFAULT '{}'::jsonb,    -- e.g. { score: 5, of: 6 } for boss
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX stream_events_email_idx       ON stream_events (email, created_at DESC);
CREATE INDEX stream_events_topic_idx       ON stream_events (topic_id, created_at DESC);
CREATE INDEX stream_events_created_idx     ON stream_events (created_at DESC);

-- 3.1.8 Rate limits — per-email per-action sliding window counters. Replace
-- with Cloudflare Durable Objects later; in MVP, this table is fine.
CREATE TABLE rate_limits (
  email       CITEXT NOT NULL,
  action      TEXT   NOT NULL,                       -- 'tune_in' | 'report' | 'snapshot'
  window_at   TIMESTAMPTZ NOT NULL,                  -- bucketed start (1-min granularity)
  count       INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (email, action, window_at)
);

-- 3.1.9 Audit log (admin actions only)
CREATE TABLE admin_audit (
  id           BIGSERIAL PRIMARY KEY,
  admin_email  CITEXT NOT NULL,
  action       TEXT   NOT NULL,
  target_email CITEXT,
  detail       JSONB,
  at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 3.2 Why this shape

- **Email is the primary key everywhere.** It's already the cognition-layer's tenancy primitive; we keep one tenancy concept across both backends.
- **`profile_aggregates` is a derived projection**, not source-of-truth. Source of truth lives in the SPA's `PlayerState`. The SPA POSTs idempotent snapshots; social-svc upserts. We never re-derive XP from the social DB — it's a cache that's allowed to be a few minutes stale.
- **`stream_events` is append-only.** No deletes (other than via profile cascade). This avoids any "edit history" foot-gun and lets us re-rank a card at any point without touching its row.
- **`tune_ins.status` collapses approved + pending into one table** instead of two. Simpler queries, single-row state changes on approval, fewer round-trips.
- **`profiles.banned_social`** is a separate column from `profiles.banned` (the global ban already in `MockUser.banned`). Lets admin scope a punishment to social only and keep the player learning.

### 3.3 Why **not** here

| Decision | Rationale |
|---|---|
| No `posts` table | MVP Stream is event-derived, not authored. Punted to Sprint 3. |
| No `comments`, `reactions` tables | Same. |
| No `notifications` table | We use unread-counts derived from `created_at > last_seen`. Cheaper than a fan-out table for MVP. |
| No `friendships` (mutual) table | Asymmetric model is the design. |
| No `dm_conversations` | Out of scope. |
| No FK to mem0's tables | Hard isolation between cognition and social DBs. They share only the email PK shape. |

---

## 4. Service interface — `SocialService` (TypeScript) + REST surface

### 4.1 Type contract (`app/src/social/types.ts`)

```ts
export type ProfileMode = "open" | "closed";

export interface PublicProfile {
  email: string;            // never displayed; needed for follow APIs
  handle: string;
  displayName: string;      // resolved per-viewer (first or full)
  pictureUrl?: string;
  guildTier: GuildTier;
  streak: number;
  xpTotal: number;
  signals: TopicId[];
  badges: string[];
  ageBandIsKid: boolean;    // viewer-side decisions only; never cross-leaks age
  profileMode: ProfileMode;
  signupAt: number;
  // Optional sections — undefined if hidden by the owner or by a Closed profile.
  currentWork?:    { topicId: TopicId; level: number; topicName: string };
  topicMap?:       { topicId: TopicId; xp: number }[];
  activity14d?:    number[];
}

export type TuneInStatus = "approved" | "pending";

export interface TuneInEdge {
  follower: string;
  target:   string;
  status:   TuneInStatus;
  muted:    boolean;
  createdAt: number;
  approvedAt?: number;
}

export type StreamCardKind = "level_up" | "boss_beaten" | "streak_milestone" | "spotlight";

export interface StreamCard {
  id: string;
  authorHandle: string;
  authorDisplay: string;
  authorPicture?: string;
  authorTier: GuildTier;
  topicId?: TopicId;
  topicName?: string;
  level?: number;
  kind: StreamCardKind;
  detail?: Record<string, unknown>;
  createdAt: number;
  iAmTunedIn: boolean;
  iCanTuneIn: boolean;          // false if Closed and no pending request
}

export type ReportReason =
  | "spam" | "harassment" | "off-topic" | "impersonation" | "other";

export interface SocialService {
  // -- read --
  getMyProfile():                                Promise<PublicProfile>;
  getProfile(handle: string):                    Promise<PublicProfile | null>;
  listCrew():                                     Promise<TuneInEdge[]>;
  listTunedInToMe():                              Promise<TuneInEdge[]>;
  listPendingIncoming():                          Promise<TuneInEdge[]>;
  listPendingOutgoing():                          Promise<TuneInEdge[]>;
  listBlocked():                                   Promise<string[]>;
  getBoard(scope: "galaxy" | TopicId | "following",
           period: "week" | "month" | "all"):     Promise<PublicProfile[]>;
  getStream(opts?: { limit?: number; before?: number }): Promise<StreamCard[]>;

  // -- write (profile) --
  updateProfile(patch: Partial<Omit<PublicProfile, "email" | "handle" | "ageBandIsKid">>):
                                                 Promise<PublicProfile>;
  setSignals(topics: TopicId[]):                  Promise<TopicId[]>;
  pushSnapshot(s: PlayerSnapshot):                Promise<void>;   // §4.4

  // -- write (graph) --
  tuneIn(targetHandle: string):                   Promise<TuneInEdge>;
  tuneOut(targetHandle: string):                  Promise<void>;
  approveSignalRequest(followerEmail: string):     Promise<void>;
  declineSignalRequest(followerEmail: string):     Promise<void>;
  cancelMyPendingRequest(targetHandle: string):    Promise<void>;
  setMuted(targetHandle: string, muted: boolean):  Promise<void>;
  block(targetHandle: string):                    Promise<void>;
  unblock(targetEmail: string):                    Promise<void>;
  report(targetHandle: string, reason: ReportReason, note?: string,
         context?: Record<string, unknown>):       Promise<void>;

  // -- meta --
  health(): Promise<{ ok: boolean; backend: "offline" | "online"; details?: unknown }>;
}

export interface PlayerSnapshot {
  // What the SPA POSTs after every state change.
  // Idempotent, server-side upsert into profile_aggregates.
  xpTotal: number; xpWeek: number; xpMonth: number;
  streak: number; guildTier: GuildTier;
  currentTopicId?: TopicId; currentLevel?: number;
  badges: string[];
  topicXp: Record<TopicId, number>;
  activity14d: number[];
  events: Array<{ kind: StreamCardKind; topicId?: TopicId; level?: number;
                  detail?: Record<string, unknown>; clientId: string }>;
  clientWindow: { from: number; to: number };
}
```

### 4.2 REST surface — `social-svc`

All endpoints are POST/PUT/DELETE *or* GET, all under `/v1/social/`. Auth: bearer token (the same `Authorization: Bearer …` header already used by mem0). Tenancy header injected by the proxy: `X-User-Email: <gmail>`. Each endpoint validates that header against `profiles` and 403s if missing/banned.

| Verb + path | Body / params | Returns |
|---|---|---|
| `GET  /v1/social/me` | — | `PublicProfile` (full, owner view) |
| `PUT  /v1/social/me` | `{ ...patch }` | `PublicProfile` |
| `POST /v1/social/me/snapshot` | `PlayerSnapshot` | `204` |
| `PUT  /v1/social/me/signals` | `{ topics: TopicId[] }` | `{ topics }` |
| `GET  /v1/social/profiles/:handle` | — | `PublicProfile \| null` (viewer-resolved) |
| `GET  /v1/social/me/crew?status=approved\|pending` | — | `TuneInEdge[]` |
| `GET  /v1/social/me/tuned-in-to-me?status=approved\|pending` | — | `TuneInEdge[]` |
| `GET  /v1/social/me/blocked` | — | `string[]` |
| `POST /v1/social/tune-in/:handle` | — | `TuneInEdge` |
| `DELETE /v1/social/tune-in/:handle` | — | `204` |
| `POST /v1/social/requests/:followerEmail/approve` | — | `204` |
| `POST /v1/social/requests/:followerEmail/decline` | — | `204` |
| `DELETE /v1/social/requests/outgoing/:targetHandle` | — | `204` |
| `PUT  /v1/social/mutes/:handle` | `{ muted: boolean }` | `204` |
| `POST /v1/social/blocks/:handle` | — | `204` |
| `DELETE /v1/social/blocks/:targetEmail` | — | `204` |
| `POST /v1/social/reports` | `{ targetHandle, reason, note?, context? }` | `204` |
| `GET  /v1/social/boards/:scope?period=…` | scope = `galaxy` \| `following` \| `topic:<id>` | `PublicProfile[]` (≤100) |
| `GET  /v1/social/stream?limit=&before=` | — | `StreamCard[]` |
| `GET  /v1/social/admin/reports?status=open` | admin only | `Report[]` |
| `POST /v1/social/admin/reports/:id/resolve` | admin only `{ resolution }` | `204` |
| `GET  /health` | — | `{ status: "ok", version }` |

**Error model**: standard `application/problem+json` shape. Notable codes:

| Code | Meaning |
|---|---|
| `400 invalid_handle` | handle not lowercase-ascii / disambiguated |
| `403 closed_profile` | viewer is not approved for this Closed profile |
| `403 blocked` | block in either direction |
| `404 not_found` | profile or report not found, *or* viewer is blocked (intentional ambiguity) |
| `409 already_tuned_in` | idempotency on tune-in is "no-op + return current edge" not 409 — we only 409 on *contradictory* requests (e.g. blocking yourself) |
| `422 cap_exceeded` | Signals > 5, outbound tune-ins > 500 |
| `429 rate_limited` | with `Retry-After` |

### 4.3 Idempotency

- `tune-in`, `tune-out`, `block`, `unblock`, `mute`: idempotent (re-running yields current state, never an error).
- `report`: 1 client-id-scoped report per `(reporter, reported, reason)` per 24 h is collapsed into a single row. Spam protection.
- `pushSnapshot`: idempotent server-side via `(email, clientWindow.to)` upsert key.

### 4.4 Snapshot semantics — how `profile_aggregates` and `stream_events` get written

The SPA already owns the source of truth (`PlayerState`). Rather than rebuilding game logic in social-svc, the SPA fires a `pushSnapshot` after every mutating event in `PlayerProvider`:

```ts
// inside PlayerProvider, after dispatch
useEffect(() => {
  if (!hydrated || !state.identity) return;
  void social.pushSnapshot(buildSnapshot(state, prevState));
}, [state, hydrated]);
```

`buildSnapshot()` (a pure helper) computes:
1. `profile_aggregates`-shaped fields (xp, streak, etc.).
2. A diff of `events` since `prevState` — exactly the things that produce `stream_events` rows. Each event has a `clientId` (UUID v4) so server-side upsert is idempotent across retries / StrictMode double-fires.

The server validates the snapshot is plausible (xp monotonic non-decreasing, no impossible jumps), upserts the aggregate, and inserts new event rows. Snapshots are rate-limited (60/min/email). Snapshots are fire-and-forget on the client — wrapped in a `withSocialGuard()` mirroring `withMemoryGuard()`. Critical UX path is never blocked.

This pattern means social-svc has **no game logic** — it only sees the post-state. If we tune XP awards or change the streak rule, the social side updates automatically.

### 4.5 Stream card derivation

Cards are computed at read time from `stream_events`, not stored as cards. Algorithm:

```
for the calling user U:
   rows = SELECT … FROM stream_events e
          WHERE
            e.created_at > now() - interval '14 days'
            AND e.email != U.email
            AND e.email NOT IN (U's blocked-by-me)
            AND e.email NOT IN (people-who-blocked-me)
            AND e.email NOT IN (U's muted authors)
            AND (
              -- visible because tuned in
              e.email IN (U's approved tune-ins)
              OR
              -- visible because Signal overlap and author is Open
              (EXISTS Signal overlap AND author.profile_mode = 'open')
              OR
              -- spotlight: top mover on a Signal of mine
              e.kind = 'spotlight' AND e.topic_id IN (U's signals)
            )
            AND author.banned = FALSE
            AND author.banned_social = FALSE
            AND (author.age_band <> 'kid' OR U.age_band = 'kid')   -- kid isolation
   for each row, compute score (formula in PRD §4.5)
   ORDER BY score DESC
   LIMIT 50
```

`spotlight` cards are inserted by a 5-minute cron inside social-svc that picks the top mover (by `xp_week`) per Signal and emits one `kind='spotlight'` row if there's a candidate without an existing recent spotlight.

### 4.6 Handle generation algorithm

When a player first calls `GET /v1/social/me` and no profile row exists, social-svc auto-creates one:

```
base    = lower(local_part(email))
            // strip non-[a-z0-9_-]; collapse runs of '_' '-'; trim length to 24
candidates = [base, base+'2', base+'3', …, base+'9999']
pick the first candidate with no row in profiles.handle (case-insensitive)
if all 9999 taken → 409 with admin-only escalation
```

Handles are immutable in MVP. (Documented; revisited Sprint 3.)

---

## 5. SPA architecture

### 5.1 New / changed files

| Path | Status | Purpose |
|---|---|---|
| `app/src/social/types.ts` | new | Types from §4.1. |
| `app/src/social/index.ts` | new | `selectSocialService(adminCfg, identity)` resolver mirroring `memory/index.ts`. |
| `app/src/social/offline.ts` | new | `OfflineSocialService` — localStorage-only impl. |
| `app/src/social/online.ts` | new | `OnlineSocialService` — REST client (`fetch` + 6s timeout, retry policy). |
| `app/src/social/snapshot.ts` | new | `buildSnapshot(prev, next)`; `withSocialGuard`. |
| `app/src/social/SocialContext.tsx` | new | React provider; status hook; outbox; mirrors `MemoryContext`. |
| `app/src/social/handles.ts` | new | Local handle utilities (used by Profile view router). |
| `app/src/views/Profile.tsx` | new | Public profile screen. |
| `app/src/views/SparkStream.tsx` | new | The feed. |
| `app/src/views/Network.tsx` | new | Manage Constellation / Tuned-in / Pending / Blocked / Signals. |
| `app/src/admin/AdminModeration.tsx` | new | Reports queue tab. |
| `app/src/App.tsx` | edit | Add `social` views to `View` union; wrap tree in `SocialProvider`. |
| `app/src/components/TabBar.tsx` | edit | 4 → 5 tabs; rename Guild → Boards. |
| `app/src/components/TopBar.tsx` | edit | Avatar menu entries; unread dots. |
| `app/src/views/Home.tsx` | edit | "On your Stream" rail + "People in your Crew" widget. |
| `app/src/views/TopicView.tsx` | edit | "On the {Topic} Constellation Board" rail. |
| `app/src/views/Leaderboard.tsx` | edit | Becomes Boards (tabbed). Keep file name to minimize diff churn; rename only the export when the whole rename is one PR. |
| `app/src/views/Settings.tsx` | edit | New Network section. |
| `app/src/admin/AdminConsole.tsx` | edit | Register `AdminModeration` tab. |
| `app/src/admin/types.ts` | edit | Add `socialEnabled`, `streamEnabled`, `boardsEnabled`, `socialServerUrl`, `socialApiKey`, `defaultProfileMode`, `streamWeights`, `signalsMaxPerUser`, `tuneInRateLimits` to `FeatureFlags` and `AdminConfig`. |
| `app/src/admin/defaults.ts` | edit | Defaults for the new flags (off in code; on in live `localStorage`). |
| `app/src/admin/store.ts` | edit | Forward-compat merge of new fields. |
| `app/src/types.ts` | edit | Optional: add `socialPrefs` to `PlayerState` (mirror of profile-mode for offline). Keep the addition narrow. |
| `app/src/store/PlayerContext.tsx` | edit | After-save effect that fires `social.pushSnapshot` (guarded). |
| `app/src/visuals/Mascot.tsx` | edit | New mood `social`. |
| `app/src/__tests__/social.*.test.ts(x)` | new | See §8. |
| `services/social-svc/` | new directory | Node + Postgres backend. |
| `services/auth-proxy/` | new directory | Cloudflare Worker source. |
| `docker-compose.social.yml` | new | Local dev: Postgres-2 + social-svc. |
| `scripts/deploy-social.ts` | new | Mirror of `scripts/deploy-mem0.*`. |
| `scripts/smoke-social.ts` | new | Mirror of `scripts/smoke-memory.*`. |
| `nginx.conf` | edit | Add `/u/<handle>` rewrite to SPA index (already SPA fallback; we just confirm `try_files`). |

### 5.2 `SocialProvider` skeleton (decision-driving sketch)

```ts
// app/src/social/SocialContext.tsx
export function SocialProvider({ children }: { children: ReactNode }) {
  const { config } = useAdmin();
  const { state } = usePlayer();
  const service = useMemo(
    () => selectSocialService(config, state.identity),
    [config.flags.socialEnabled, config.socialServerUrl, state.identity?.email]
  );
  const [status, setStatus] = useState<SocialStatus>({ ok: true, backend: "offline" });

  // Outbox: queue snapshots + writes when offline; flush on reconnect.
  const outboxRef = useRef<Queue<SocialOp>>(new Queue({ cap: 200, ttlMs: 30 * 60_000 }));

  // Snapshot pipe: PlayerProvider's state changes call into a dispatcher
  // that diffs and enqueues an op. We expose `pushSnapshot` via context too,
  // for completeness (Boss-pass etc. that already are special-cased).

  // Status loop (cheap health probe, every 30s)
  useEffect(() => {
    if (!state.identity) return;
    const id = setInterval(async () => {
      const s = await service.health();
      setStatus(s);
      if (s.ok) await flushOutbox(outboxRef.current, service);
    }, 30_000);
    return () => clearInterval(id);
  }, [service, state.identity]);

  const value = useMemo(() => ({ service, status }), [service, status]);
  return <SocialCtx.Provider value={value}>{children}</SocialCtx.Provider>;
}
```

### 5.3 Resolution rule (mirrors `memory/index.ts`)

```
if !state.identity → OfflineSocialService                  // pre-signin
if AdminConfig.flags.socialEnabled === false → OfflineSocialService
if AdminConfig.socialServerUrl === ""        → OfflineSocialService (degrade)
otherwise → OnlineSocialService(socialServerUrl, socialApiKey, identity.email)
```

### 5.4 `OfflineSocialService`

A real, working service backed by `localStorage` (per `state.identity.email`). It:

- Maintains a single-tenant view: it's *only* this user's data, simulated.
- Returns an empty Stream / Boards.
- Profile is editable; settings persist; "Tune-in" is a no-op that surfaces a toast: *"Social network is offline. Configure social-svc in admin."*
- `health()` always `{ ok: true, backend: "offline" }`.

This matches the precedent set by `OfflineMemoryService` and keeps the offline path a first-class citizen for forks.

### 5.5 Routing for `/u/<handle>`

The SPA stays SPA-shaped. We add URL-parameter awareness:

```ts
// in App.tsx, on first render
const params = new URLSearchParams(location.search);
const initialView: View = params.get("u")
  ? { name: "profile", handle: params.get("u")! }
  : { name: "home" };
```

For prettier links (`/u/maya`), `nginx.conf`'s existing `try_files $uri /index.html;` already serves index.html. We additionally add a small bit of client-side path parsing:

```ts
// rewrite /u/<handle> to ?u=<handle> on first paint
const m = location.pathname.match(/^\/u\/([a-z0-9_-]+)\/?$/);
if (m) history.replaceState({}, "", `/?u=${m[1]}`);
```

Static hosts (Vercel / Netlify / cloud-claude.com) all do SPA fallback for unknown paths. No router library added.

### 5.6 Pulling stream/board data — caching

- Stream + Boards use a tiny SWR-style hook (`useSocialQuery(key, fn, ttlMs)`) that's <30 LOC. No external dep added.
- TTL: 60s for Boards, 30s for Stream, 15s for "Pending Signal requests" (it's the most latency-sensitive).
- Pull-to-refresh in mobile-first views invalidates the relevant cache key.

---

## 6. Auth-verifying proxy

### 6.1 Why now

Per `architecture.md`:
> *"The proxy is a Cloudflare Worker (~50 lines) that verifies the Google ID token, injects user_id server-side, rate-limits per Gmail, and forwards. Both the bearer-in-browser problem and the multi-tenant audit story go away."*

We cash that in here because `social-svc` is intrinsically multi-tenant (it answers questions about *other* users). Putting bearer-in-browser there is unacceptable. The same proxy also fronts mem0 from this PR forward — so the cognition layer immediately benefits.

### 6.2 Worker behavior

```
on every request:
  let id_token = req.headers["x-id-token"]    // SPA passes Google ID token
  let claims = verify_google_id_token(id_token, GOOGLE_OAUTH_CLIENT_ID)
                  // standard JWKS verification; cache keys for 24h
  if !claims || !claims.email_verified || !claims.email.endsWith("@gmail.com"):
    return 401
  if rate_limit(claims.email, route) exceeded:
    return 429
  // strip x-id-token; inject trusted headers
  req.headers["x-user-email"] = claims.email
  req.headers["authorization"] = `Bearer ${env.UPSTREAM_KEY_FOR(targetHost)}`
  forward to mem0 or social-svc based on path prefix
```

The Worker holds the upstream API keys in its env (`UPSTREAM_KEY_MEM0`, `UPSTREAM_KEY_SOCIAL`); the SPA never sees them. This **closes the bearer-in-browser issue called out in `mvp.md`**.

### 6.3 Rate limits (per-email, sliding window)

Defaults (admin-tunable via env on the Worker, mirrored in `AdminConfig.tuneInRateLimits`):

| Action prefix | Per minute | Per hour |
|---|---|---|
| `POST /v1/social/tune-in` | 60 | 600 |
| `POST /v1/social/reports` | 5 | 20 |
| `POST /v1/social/me/snapshot` | 60 | 1800 |
| `GET  /v1/social/*` | 600 | 6000 |
| `* /v1/memories/*` | (existing mem0 limits) | |

Storage: Cloudflare KV with 1-min bucket keys. Acceptable approximation for MVP.

### 6.4 Failure modes

| Failure | Behavior |
|---|---|
| Worker unreachable | SPA falls back to OfflineSocialService; `health()` returns `{ok:false}`; Stream/Boards show empty state. |
| Worker returns 401 | SPA prompts re-sign-in. Memory and social both pause. |
| social-svc down behind a healthy Worker | SPA shows 🟡 social pause badge in TopBar (analogous to memory pause). |
| Postgres-2 down | Worker returns 503; SPA queues writes in outbox. |

---

## 7. Admin surfaces — code-level

### 7.1 New flags + tunables in `AdminConfig`

```ts
// app/src/admin/types.ts
export interface FeatureFlags {
  // …existing…
  socialEnabled: boolean;
  streamEnabled: boolean;
  boardsEnabled: boolean;
  defaultProfileMode: ProfileMode;   // default 'open'
  // Field-level defaults applied to new profiles (kid override applies later)
  defaultShowFullName: boolean;      // default false
  defaultShowCurrent: boolean;       // default true
  defaultShowMap: boolean;           // default true
  defaultShowActivity: boolean;      // default true
  defaultShowBadges: boolean;        // default true
}

export interface SocialConfig {
  serverUrl: string;
  apiKey?: string;
  signalsMaxPerUser: number;     // default 5
  tuneInsMaxOutbound: number;    // default 500
  reportsPerEmailPerDay: number; // default 20
  streamWeights: {
    recencyHalfLifeHours: number; // default 18
    tuneIn: number;               // default 1.0
    signalOverlap: number;        // default 0.3
    qualityTier: number;          // default 0.2
  };
}

export interface AdminConfig {
  // …existing…
  socialConfig: SocialConfig;
}
```

`store.ts` merges new fields forward (same defensive merge pattern already used for `memoryConfig`). Tests in `__tests__/admin.test.ts` already cover the merge — extend them.

### 7.2 `AdminModeration` tab (new file)

UI:

- Two queue tabs: **Open** (default) / **Resolved** (audit).
- Each row: reporter handle (clickable → profile), reported handle, reason chip, note, context preview (`profile` snapshot card or `stream-card` snapshot block), age, action cluster: *Warn* / *Ban from social* / *Global ban* / *No action*.
- Bulk action: select multiple, "No action" them in one go.
- Search by handle, filter by reason.
- Calls `social.admin.listReports`, `social.admin.resolveReport`. Backed by the proxy verifying `X-User-Email ∈ admins`.

### 7.3 `AdminUsers` extensions

Each row gains: `Profile mode`, `# tune-ins`, `# tuned-in-to-them`, `# active reports`, `Ban from social` switch (separate from the existing global ban).

### 7.4 `AdminAnalytics` extensions

Already shows DAU/WAU/MAU. We add (graceful-degradation if social is offline):

- Tune-in graph density (`edges / profiles²`).
- Stream cards / day, by kind.
- Signals distribution across Constellations.
- Average per-Constellation Board population.
- % profiles set to Closed (overall + by age band).

Pulled via new `/v1/social/admin/analytics` endpoints.

---

## 8. Tests — minimum bar (extends `app/src/__tests__/`)

Today's test floor is **90 / 90** across 12 files. We add **at least 28 new tests across 7 files**, leaving us ≥ 118 / 118 green.

| File | Locks in |
|---|---|
| `__tests__/social.offline.test.ts` | OfflineSocialService: profile read/write round-trip, tune-in is a no-op with toast, no network call ever. |
| `__tests__/social.online.test.ts` | Mocks `fetch`. Verifies path, headers, body shape, error surfacing for: tune-in / tune-out / block / report / snapshot. |
| `__tests__/social.snapshot.test.ts` | `buildSnapshot(prev, next)` produces correct events for: spark complete, level reach, boss pass, streak crossing 7/30/100. Idempotent across StrictMode double-fires (clientId stable). |
| `__tests__/social.guard.test.ts` | `withSocialGuard()` swallows 5xx + timeout, returns sentinel. UI never throws. |
| `__tests__/social.privacy.test.tsx` | A Closed profile renders the gated card. Owner sees full content. Approved follower sees full content. Blocked viewer sees 404. Kid profile invisible to adult viewer. |
| `__tests__/social.boards.test.tsx` | Galaxy includes only Open profiles with Synapses > 0. Per-Constellation requires a Signal. Following filter respects approved tune-ins only. Mock filler sorts below real rows. |
| `__tests__/social.stream.test.tsx` | Ranking deterministic given fixed weights; my own events filtered out; muted author filtered out; spotlight cards present iff topic ∈ my Signals. |
| `__tests__/admin.moderation.test.tsx` | Listing reports requires admin allowlist. Resolving writes audit row. Bulk-no-action works. |
| `__tests__/admin.flags.social.test.ts` | Toggling `socialEnabled` swaps Online ↔ Offline; toggling `boardsEnabled` hides Boards tabs. |
| `__tests__/handles.test.ts` | Disambiguation: `maya@…`, `maya@otherdomain.…` → `maya`, `maya2`. Punctuation stripping. Length cap. |

Server-side tests (under `services/social-svc/__tests__/`):

- Migrations apply cleanly to a fresh DB.
- Snapshot upsert is idempotent on `(email, clientWindow.to)`.
- Tune-in onto a Closed profile creates a `pending` row; approval flips it to `approved` and sets `approved_at`.
- Block cascades: removes any pending request both ways; subsequent tune-in returns 403.
- Report: 21st report from same email in 24h returns 429.
- Stream query filters: blocked, banned, kid-vs-adult, muted authors all excluded.
- Spotlight cron emits one row per signal per ≥6h window.

Worker tests (`services/auth-proxy/__tests__/`):

- Bad ID token → 401.
- Non-Gmail → 401.
- Rate limit returns 429 with `Retry-After`.
- Forwarding strips `x-id-token` and adds `x-user-email`.

---

## 9. Performance budgets

| Surface | Budget | Mitigation if missed |
|---|---|---|
| Profile open (cached) | 95p < 250 ms | SWR cache; lazy avatar preload. |
| Profile open (cold, signed-in) | 95p < 800 ms | Single round trip; viewer-resolved fields server-side. |
| Stream first paint | 95p < 1200 ms | Show skeleton; render cards as they arrive (incremental). |
| Snapshot push | fire-and-forget; UI never waits | Outbox queue; reject & log if we ever observe blocking. |
| Boards load | 95p < 600 ms (≤100 rows) | Single SQL with `LIMIT 100`; precomputed `xp_week`/`xp_month`. |
| Bundle delta | ≤ +120 KB gzipped | Lazy-load `Profile` and `SparkStream` views via dynamic `import()`. |

Server-side:

- `GET /v1/social/stream` 95p < 200 ms at 50k profiles, 1M `stream_events`. Single index-backed query + post-rank in Node. We benchmark with seeded data in CI.
- `POST /v1/social/me/snapshot` 95p < 80 ms (single upsert + at-most-N event inserts).

---

## 10. Telemetry

Server-side (already-existing `admin_audit` + new `social_metrics`):

- Counter: `social.tune_in.created`, `social.tune_out.removed`, `social.block.created`, `social.report.created`, by reason.
- Gauge: open profiles, closed profiles, by age band; total edges; total active Signals by topic.
- Histogram: snapshot latency, board query latency.
- Per-card: card kind, author tier, viewer-tier, score, position.

Client-side (logs to social-svc via a small `/v1/social/me/events` endpoint, batched 30s):

- `stream.card.shown`, `stream.card.tap`, `stream.card.tune_in`, `stream.card.mute_author`, `stream.card.report`.
- `boards.tab.open`, `boards.row.tune_in`.
- `profile.open`, `profile.share_link`.
- `network.profile_mode.flip`.

These power the success metrics in the PRD §7.

---

## 11. Rollout plan — phase by phase, single PR

The PR lands all of the below behind feature flags. **Default state of flags in code is OFF**; we flip them ON post-merge in the live admin `localStorage` and via env-baked defaults on the cloud-claude.com deploy.

### Phase 0 — code lands (this PR merges)

Everything in §5–§8 ships, gated by `socialEnabled = false` in `defaults.ts`. With the flag off:
- TabBar still 4 tabs (Stream tab hidden by flag).
- Leaderboard renders the existing single-board view (Boards UI hidden by flag).
- Settings → Network section absent.
- TopBar avatar menu: no profile / network entries.
- AdminModeration tab hidden.

CI: 90 → 118 green.

### Phase 1 — stand up social-svc (1 day after merge)

Run the migrations on a fresh Fly Postgres-2. Deploy `social-svc` (single Fly app, healthcheck wired).

```sh
DATABASE_URL=… SOCIAL_API_KEY=… npm run deploy:social
npm run smoke:social -- https://learnai-social.fly.dev <bearerKey>
```

### Phase 2 — stand up the auth-verifying proxy (1 day after Phase 1)

Cloudflare Worker deployed with `wrangler publish`. Switch the SPA's mem0 base URL to point at the proxy too — closes the bearer-in-browser issue.

### Phase 3 — flip flags ON (live deploy)

In live admin localStorage:
- `socialEnabled = true`, `streamEnabled = true`, `boardsEnabled = true`.
- Set `socialConfig.serverUrl` to the proxy URL.
- Verify the new TabBar appears, Profile resolves, Stream renders something, Boards repopulate, Settings → Network appears.

### Phase 4 — soft launch (week +1 after Phase 3)

Monitor success metrics from PRD §7. Iterate stream weights via admin tunables, not code changes. If a P0 surfaces, flag flip is the kill switch.

### Phase 5 — telemetry pass (week +2)

The two-week post-launch read in PRD §7. Result documented in `docs/mvp.md` (move four entries from "Not yet shipped" to "Shipped"; bump `roadmap.md`'s "Sprint 2" to ✅).

---

## 12. Reverse path — disabling cleanly

Mirroring `technical.md` §10:

1. Flip `socialEnabled → false` in admin. Within 30 s, all SPA sessions read the flag (next render) and revert to `OfflineSocialService`. UI hides social affordances.
2. social-svc keeps running. Postgres-2 keeps the data.
3. Re-enable later: data still there, profiles pop back. No data loss.
4. **Permanent rollback** (worst case): drop the four new tabs, scrub `tune_ins` / `blocks` / `reports` / `stream_events` / `signals`. `profile_aggregates` survives if we want to keep public profiles read-only.

---

## 13. Risk register (engineering)

| Risk | Likelihood | Severity | Mitigation |
|---|---|---|---|
| Snapshot push grows unbounded if a player has lots of events | Medium | Medium | Server caps `events.length ≤ 50` per snapshot; client buckets older events. |
| `tune_ins` unique constraint races on rapid double-tap | Medium | Low | Idempotent UPSERT with `ON CONFLICT DO UPDATE`. |
| Handle generation collides at scale | Low | Medium | Disambiguation up to 9999, then 409 + admin-set handle. |
| Proxy cold-start latency in CF Workers | Low | Low | Pre-warm via cron ping. |
| Postgres-2 row growth from `stream_events` | Medium | Medium | Daily partitioning by `created_at` once `stream_events > 10M`; nightly cron prunes rows older than 90 days. |
| Bundle delta exceeds +120 KB | Medium | Low | Profile + Stream are dynamically imported; we measure in CI and fail the build if budget breached. |
| Type drift between SPA `PublicProfile` and SQL `profiles` | High | Medium | Generate TS types from SQL via a tiny `npm run gen:social-types` script (sql-ts or hand-rolled). Ran as part of CI. |
| `localStorage` admin config in `OfflineSocialService` doesn't migrate cleanly | Low | Low | Same forward-merge pattern as `loadAdminConfig`; covered by tests. |
| The user's identity record is ever `email` *without* `@gmail.com` (demo mode) | High | Medium | Demo-mode profiles are flagged `demo: true` in social-svc, hidden from all Boards / Streams of non-demo users. Flag in admin: `allowDemoSocial = false` by default. |

---

## 14. What does **not** change

- `mem0` integration is untouched in shape. (It now goes through the proxy; same client code.)
- `OfflineMemoryService` / `MemoryProvider` unchanged.
- Game logic in `app/src/store/game.ts` and `badges.ts` untouched.
- `ProgressState` shape unchanged.
- `seed curriculum` untouched.
- Existing 90 tests pass unchanged.
- Public CDN URL of the SPA (`learnai-b94d78.cloud-claude.com`) — no change.

---

## 15. Open eng questions for review (mirrors PRD §11)

1. **Real-time?** Boards: 60s server-cached query. Stream: 30s SWR cache + pull-to-refresh. Plan to revisit with WebSockets only if the post-launch success metric "Stream tab feels alive" requires it.
2. **Handle uniqueness on Gmail-only sign-in.** §4.6 algorithm; immutable in MVP.
3. **Stream backfill on first tune-in.** Yes — last 7 days of cards from that author, capped at 5. Cheap (one query). Already handled by the `WHERE created_at > now() - 14d` clause; the new tune-in is just immediately included next cache refresh.
4. **`AdminModeration` ships in this PR.** Confirmed — see §7.2.
5. **`FAKE_GUILD`** — kept; demoted to an explicit "Sample roster" module (`mockUsers.ts`-style), pulled in only when the real-data result has < 10 rows. No data leakage between players.

---

## 16. Estimated size

| Area | Lines (rough) |
|---|---:|
| SPA: types + service + provider + helpers | ~900 |
| SPA: 3 new views | ~1500 |
| SPA: edits to 8 existing files | ~600 |
| social-svc (Node + Postgres) | ~1500 |
| auth-proxy (Cloudflare Worker) | ~150 |
| Migrations + seed scripts | ~400 |
| Tests (SPA + svc + proxy) | ~1800 |
| Docs (this + PRD + updates to mvp/roadmap) | ~700 |
| **Total** | **~7.5k** |

Sized as a 1-PR sprint (2–3 weeks, per `roadmap.md`). One reviewer can complete a competent pass in a working day.

---

## 17. Definition of done

- [ ] All migrations apply cleanly to a fresh DB.
- [ ] `npm test` ≥ 118 green.
- [ ] `npm run build` clean; bundle gzipped delta ≤ +120 KB.
- [ ] `services/social-svc` deploys to a clean Fly app and `npm run smoke:social` passes.
- [ ] `services/auth-proxy` deploys via `wrangler publish` and forwards traffic correctly.
- [ ] Live admin can flip `socialEnabled` ON and the new tabs appear within 30s of refresh.
- [ ] Live admin can flip the flag OFF and the app reverts to v1 social-less behavior with no data loss.
- [ ] `docs/mvp.md` "Not yet shipped" loses the four social rows; "Shipped" gains a `### Social MVP` section.
- [ ] `docs/roadmap.md` Sprint 2 marked ✅ with link to the PR.
- [ ] `docs/operator-checklist.md` gains a "Social MVP" section: deploy + rollback + moderation SLA.
- [ ] PRD ([`social-mvp-product.md`](./social-mvp-product.md)) and this engineering plan referenced from `docs/INDEX.md`.

---

## See also

- [`social-mvp-product.md`](./social-mvp-product.md) — the product view this implements.
- [`architecture.md`](./architecture.md) — the structural change this realizes (the "What changes when we ship the social + Talent Match (Sprint 2)" section).
- [`technical.md`](./technical.md) — the cognition layer's engineering doc; this one is its sibling.
- [`mem0.md`](./mem0.md) — precedent for the self-hosted-backend-with-thin-client pattern.
- [`roadmap.md`](./roadmap.md) — Sprint 2.
