# LearnAI — mem0 self-hosted architecture

> Sister docs: [`ux.md`](./ux.md), [`technical.md`](./technical.md).
>
> **Why we picked mem0 + how we run it ourselves.**

## 1. What mem0 is, in one paragraph

[mem0](https://github.com/mem0ai/mem0) is an open-source long-term memory
layer for LLM apps. You hand it raw events (a chat turn, a fact, a structured
note) and it does three useful things:

1. **Extracts** facts/preferences/goals — using an LLM you control — into
   short, human-readable memories.
2. **Stores** them in a vector store (we'll use Postgres + `pgvector`) keyed
   by a `user_id` you pass in (we use the player's Gmail).
3. **Retrieves** them back via semantic search, returning the top-k items
   relevant to a query you ask.

It also handles updates ("user changed their goal"), deletes, and per-user
isolation. It runs as a Python service with a JSON HTTP API. Self-hostable.

## 2. Why mem0 (not zep, not letta, not "just pgvector + RAG")

| Option | Why we didn't pick |
|---|---|
| **zep** | More powerful (knowledge graph) but heavier ops. We don't need graph queries on day one. Easier to graduate to later than to peel out. |
| **letta (MemGPT)** | Imposes its own *agent* runtime. We already have one (the LearnAI game loop). Higher coupling, no payoff. |
| **Vector DB only (Chroma/Weaviate/pgvector)** | That's storage, not memory. We'd reimplement the extract → summarize → dedupe loop ourselves. Big undifferentiated lift. |
| **mem0** ✅ | Smallest API surface. Memories are inspectable JSON (huge for our "Your Memory" tab). Pluggable LLM provider — uses our existing Anthropic / OpenAI key. Active project, MIT license, exactly the right level of opinion. |

There's a teaching bonus: mem0 itself is a *named, trendy open-source AI
project* that maps cleanly onto our **🌐 Open Source AI** Constellation.
We can write a Spark that explains mem0 — so the player learning about
memory layers is *literally* using one. That's hard to beat for a learning
product.

## 3. What we use mem0 for

Three jobs, in priority order:

### 3.1 Personalization — the main feature

Every meaningful in-game event becomes a candidate memory. Over weeks, mem0
condenses the player's behavior into a short list of *"things to remember
about Alex"* — goals, strengths, gaps, preferences, history (see
[`technical.md`](./technical.md) §3.4 for the taxonomy).

The player-facing surfaces (Home card, in-session nudge, recalibration
preamble, Build Card personalization, "Your Memory" tab) all consume mem0's
output. None of these existed in v1. All of them disappear cleanly when
offline mode is on.

### 3.2 Continuity across devices

Today, signing in on a new device means starting from zero. With mem0 as the
brain, the player's Gmail = their `user_id`, and every device that signs in
sees the same memories. The cohort leaderboard work in a future sprint will
share the same key.

### 3.3 Educational transparency

mem0's outputs are *human-readable*. We expose them directly. The player can
audit, edit, and forget any memory — **read-write parity** is a core promise
of the UX (see [`ux.md`](./ux.md) §5). That's hard to do with a black-box
embedding pipeline, easy to do with mem0.

## 4. The mem0 HTTP surface (what we'll call)

mem0 exposes a small REST API. We'll use these endpoints:

| Verb | Path | Purpose | Our wrapper method |
|---|---|---|---|
| POST | `/v1/memories/` | Add a memory | `add(text, metadata)` |
| GET | `/v1/memories/?user_id=…` | List memories | `list({ category })` |
| POST | `/v1/memories/search/` | Semantic search | `search(query)` |
| PUT | `/v1/memories/<id>/` | Update text | `update(id, patch)` |
| DELETE | `/v1/memories/<id>/` | Forget one | `forget(id)` |
| DELETE | `/v1/memories/?user_id=…` | Wipe a user | `wipe()` |
| GET | `/health` | Health probe | `health()` |

Every call carries `user_id = <gmail-email>` so mem0 partitions per user.
Auth: `Authorization: Bearer <key>` (the bearer is set in
`AdminConfig.memoryConfig.apiKey`; mem0 server's `MEM0_API_KEY` env must
match).

## 5. What we store / what we don't (hard rules)

### Stored (in mem0)

- Goals from onboarding ("ship a RAG demo").
- Strengths inferred from streaks of correct answers in a topic.
- Gaps inferred from streaks of wrong answers on the same concept.
- Boss Cell results (passed/failed + topic + score).
- Calibration outcomes ("re-tuned to architect; weak on safety").
- Player-stated preferences ("vendor-neutral examples please").
- Player-stated stack hints ("uses Postgres" — only if explicitly typed).

### NOT stored (in mem0)

- API keys (Anthropic, OpenAI, Google OAuth, SMTP). Live in `localStorage`
  on the user's device.
- Raw chat / typed text. We summarize first; the summary is the memory.
- IP, geolocation, browser fingerprint.
- Any other user's data — strict per-Gmail tenancy.
- The seed curriculum. Code + git, not memory.
- Email queue + SMTP credentials. Admin-side only, in `localStorage`.

### Why "no second database"

Everything cognitive lives in mem0 (which, under the hood, uses Postgres +
`pgvector`). Everything **static** — seed curriculum, illustrations, brand
config — lives in code or a small JSON/MD file checked into the repo. The
admin-side configuration (allowlist, branding, flags, email templates) stays
in `localStorage` on the admin's browser; if/when we want to share that
across admins, we'll migrate it into mem0 too as system-scoped memories.

So: **one runtime data store: mem0. One static layer: the repo.** Clean and
small.

## 6. Self-hosting

We pull mem0 from a fork we control: **[`oznakash/mem0`](https://github.com/oznakash/mem0)**, published to **GitHub Container Registry** at `ghcr.io/oznakash/mem0:latest`. Building the image once in your fork (via the workflow at `docs/mem0-fork-publish.workflow.yml` — copy it into the fork) gives you per-commit SHA tags you can pin in production.

### 6.1 Local — docker-compose

`docker-compose.mem0.yml` at the repo root provisions:

- `mem0` — pulled from `ghcr.io/oznakash/mem0:latest` (override via `MEM0_IMAGE` env).
- `postgres` — Postgres 16 with `pgvector`. Relational tables + vector index in one place.
- No Redis.

```sh
cp .env.example .env
# edit .env: set MEM0_API_KEY, OPENAI_API_KEY (or ANTHROPIC_API_KEY)
docker compose -f docker-compose.mem0.yml up -d
```

Defaults:

- Postgres: `localhost:5432`, db `mem0`, user `mem0`, password from `.env`.
- mem0: `localhost:8000`, bearer key from `.env` (`MEM0_API_KEY`).
- LLM provider: configurable via env (`OPENAI_API_KEY` or `ANTHROPIC_API_KEY`); mem0 uses it for fact extraction. Pick via `MEM0_LLM_PROVIDER`.
- Persistent volume: `mem0_pg_data`.

### 6.2 Cloud — Fly.io (recommended)

A `fly.toml` is checked in at the repo root. **One command** and you're up:

```sh
OPENAI_API_KEY=sk-... npm run deploy:mem0
```

That runs `scripts/deploy-mem0.sh`, which:

1. Verifies `fly` is installed and you're logged in.
2. Creates the app `builderquest-mem0` in `iad` if it doesn't exist (or reuses).
3. Provisions a managed Postgres `builderquest-mem0-db` and attaches it.
4. Generates a bearer key (`openssl rand -hex 32`), stores secrets.
5. `fly deploy --image ghcr.io/oznakash/mem0:latest`.
6. Prints the URL + bearer key.

The script is **idempotent** — safe to re-run; existing resources are reused.

Override defaults via env: `APP=…`, `REGION=…`, `MEM0_IMAGE=…`. Use `LLM_PROVIDER=anthropic ANTHROPIC_API_KEY=…` if you'd rather have Claude do mem0's fact extraction.

`fly.toml` is set up for `auto_stop_machines = "stop"` + `min_machines_running = 0`, so the app sleeps when idle (cheap). Bump `min_machines_running` to `1` once you have real users.

#### Smoke-test the deployment

After the deploy script prints the URL + key, verify end-to-end:

```sh
npm run smoke:memory -- https://builderquest-mem0.fly.dev <bearerKey>
```

The smoke test (`scripts/smoke-memory.mjs`) does a real round-trip: health check → add a goal → list → search → wipe. Exits 0 on full pass, non-zero with the failing step on any error.

### 6.3 Cloud — anywhere else

Render / Railway / your own VPS: same image (`ghcr.io/oznakash/mem0:latest`), same env vars, same Postgres requirement. Use whatever managed Postgres they offer (Neon's free tier is fine for our scale).

### 6.4 Pin to a SHA tag for production

Any time you ship to prod, replace `:latest` with the per-commit tag from your fork's package page:

```sh
fly deploy --image ghcr.io/oznakash/mem0:sha-abc1234
```

…or set `MEM0_IMAGE` in `.env`/Fly secrets to the same.

`.env.example` checked in; real `.env` git-ignored.

## 7. Provisioning checklist (admin side)

After running docker-compose:

1. Open the LearnAI Admin Console → **Memory** tab.
2. Paste the mem0 server URL (e.g. `https://mem0.your-domain.com`).
3. Paste the `MEM0_API_KEY` you set in the `.env`.
4. Click **Health check** → should return `{ ok: true, backend: "mem0" }`.
5. Toggle **Offline mode** off. The TopBar 📴 badge disappears.
6. (Optional) Set the **per-user daily write cap** (default 200).
7. (Optional) Set the **retention** (default: keep forever).

Done. Your players' memories will start growing.

## 8. Cost + latency expectations

- Each Spark write triggers ≤ 1 mem0 LLM extraction call (mem0 batches when
  it can). At ~$0.0005 / extraction with `gpt-4.1-mini`, 100 sparks/user/week
  ≈ $0.20/user/year. Negligible.
- p95 latency on a small Postgres + pgvector instance: write < 400 ms,
  search < 250 ms. We've budgeted 800 ms for searches with a hard timeout +
  graceful fallback.

## 9. Backups + GDPR

- Postgres `pg_dump` nightly. Keep 7 days.
- "Forget about me" → `DELETE /v1/memories/?user_id=<email>` cascades inside
  Postgres (mem0 handles this). One round-trip; visible-confirmed in the UI.
- Right-to-port: "Export my memories" → `GET /v1/memories/?user_id=<email>`
  downloaded as JSON.
- We log no PII outside mem0 itself, so the Postgres dump is the entire
  surface area.

## 10. The teaching loop (turning the layer into curriculum)

A native upside: we can write Sparks **about mem0** that the player runs
*against* the same mem0 instance powering their experience.

- A Build Card *"Add a memory: 'I'm interested in observability'. Then ask
  the system 'what do I care about?' and watch the recommendation change."*
- A MicroRead explaining how mem0 does fact extraction.
- A Boss Cell *"Which of these is mem0 NOT good at?"*

This is a strong differentiator vs. competing products: **the educational
content and the runtime are the same system**. You learn about memory by
*using your memory*.

## 11. Risks + mitigations

| Risk | Mitigation |
|---|---|
| mem0 server down → broken UX | Per §6 of `technical.md`: pause-mode badge + heuristic fallback. The game still works. |
| LLM provider for mem0 outage | mem0 retries internally; we degrade after timeout. |
| Memory drift / wrong facts about the user | "Forget" button on every memory + "Wipe all" button. Read-write parity. |
| Cost runaway | Per-user daily cap (default 200 writes/day). Admin alert on cap-breach. |
| Schema drift in mem0 across versions | Pin mem0 server image to a specific tag in docker-compose. Manual upgrades. |

## 12. Decision recap

- **Memory backend:** mem0, self-hosted via docker-compose at the repo root.
- **Underlying storage:** Postgres 16 + pgvector. No second DB.
- **Tenancy primitive:** Gmail email = mem0 `user_id`.
- **Default mode:** offline (cognition off). Admin opts-in by configuring
  the server and toggling the flag.
- **Where the static stuff lives:** seeded curriculum + admin config in
  code + localStorage; secrets in env; everything cognitive in mem0.
- **Privacy ethic:** read-write parity, one-tap wipe, no cross-user surface.
