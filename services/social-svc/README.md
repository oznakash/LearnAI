# social-svc

The LearnAI social-graph backend. Self-hosted, Node + Express, single binary. Owns *public-shaped* data only — profiles, follows, blocks, reports, signals, stream events. The cognition layer (mem0) stays in its own service.

> Sister docs: [`docs/social-mvp-product.md`](../../docs/social-mvp-product.md), [`docs/social-mvp-engineering.md`](../../docs/social-mvp-engineering.md).

## What it is

- A small REST API that mirrors the `SocialService` contract used by the SPA (`app/src/social/types.ts`).
- One Node process. Default storage: in-memory + optional JSON-file persistence (`SOCIAL_DB_PATH`). Drop-in upgrade path to Postgres documented below.
- No dependency on mem0 — they share the same Gmail-as-tenancy primitive but live in separate processes.

## Run it

```bash
npm install
npm run build
SOCIAL_DB_PATH=./social.db.json SOCIAL_ADMIN_EMAILS=admin@example.com PORT=8787 npm start
```

Quick smoke:

```bash
curl -s http://localhost:8787/health
# {"status":"ok","version":"0.1.0"}

curl -s http://localhost:8787/v1/social/me \
  -H "x-user-email: maya@gmail.com" | jq
```

## Auth model

Every request requires `X-User-Email`. In production this is injected by the auth-verifying proxy (PR 8) after verifying the player's Google ID token. In demo / fork mode the SPA can send it directly.

`SOCIAL_ADMIN_EMAILS` (comma-separated) gates the `/v1/social/admin/*` endpoints.

## Endpoints (MVP)

| Verb | Path | Purpose |
|---|---|---|
| GET | `/health` | Liveness |
| GET | `/v1/social/me` | Owner's profile (auto-created on first call) |
| PUT | `/v1/social/me` | Patch profile fields |
| PUT | `/v1/social/me/signals` | Set up to 5 Topic Signals |
| POST | `/v1/social/me/snapshot` | Idempotent snapshot of player aggregate + new stream events |
| GET | `/v1/social/profiles/:handle` | Viewer-aware projection |
| POST | `/v1/social/follow/:handle` | Follow (or create pending request for Closed) |
| DELETE | `/v1/social/follow/:handle` | Unfollow |
| PUT | `/v1/social/follow/:handle/mute` | Mute / unmute |
| POST | `/v1/social/requests/:followerEmail/approve` | Approve a pending follow request |
| POST | `/v1/social/requests/:followerEmail/decline` | Decline a pending follow request |
| DELETE | `/v1/social/requests/outgoing/:targetHandle` | Cancel my pending outgoing request |
| GET | `/v1/social/me/following` | List my follows (?status=approved\|pending) |
| GET | `/v1/social/me/followers` | List who follows me |
| GET | `/v1/social/me/blocked` | List blocked emails |
| POST | `/v1/social/blocks/:handle` | Block target (removes any existing follow edges) |
| DELETE | `/v1/social/blocks/:targetEmail` | Unblock |
| POST | `/v1/social/reports` | Submit a report; auto-mutes target |
| GET | `/v1/social/boards/:scope` | (MVP) returns `[]` — full ranking lands later |
| GET | `/v1/social/stream` | Returns cards from approved follows only |
| GET | `/v1/social/admin/reports` | Admin: report queue |
| POST | `/v1/social/admin/reports/:id/resolve` | Admin: resolve a report |

## Tests

```bash
npm test
```

The suite uses `supertest` + `vitest` against `createApp({ store })`. ~25 server-side tests, mirroring the SPA's offline-service contract.

## Storage migration to Postgres

The current `src/store.ts` is a pure-memory + JSON-file implementation. To swap to Postgres-2:

1. Apply the schema from `docs/social-mvp-engineering.md` §3.1.
2. Replace `createStore({ dbPath })` with a thin `pg`-based adapter that exposes the same `Store` interface.
3. No other module needs to change — `app.ts`, route handlers, and projection are all storage-agnostic.

Operationally, mem0 already runs on Fly.io with its own Postgres; social-svc's deploy will mirror that with an additional Postgres instance + `Dockerfile` (lands with the proxy PR).

## What this service does **not** do

- No cognition — memories live in mem0.
- No game logic — XP / streak / tier all come from the SPA via `pushSnapshot`. The service is a public-safe projection of player progress, not a game engine.
- No engagement-feedback ranking — explicit anti-pattern (vision §4).
