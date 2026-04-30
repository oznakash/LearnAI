# Production Auth — Handoff

> **Pause state.** The active session was asked to stop mid-Phase-1 and write this handoff so any future session can pick up.
> Companion doc: [`server-auth-plan.md`](./server-auth-plan.md) — the original plan and status table.

## Why this doc exists

User paused Phase 1 work on `oznakash/mem0` and asked: **"nothing in mem0 codebase needs to be changed?"** That question deserves a clear answer + a complete snapshot of where we are, so the next session (human or AI) doesn't waste cycles re-deriving context.

## Direct answer to "does mem0 need to change?"

**For the architecture proposed in [`server-auth-plan.md`](./server-auth-plan.md): yes, it has to.** mem0 is the only backend in the LearnAI stack. The Google ID-token verification + session JWT minting has to run somewhere server-side; mem0 is the only "somewhere" we have.

**If we don't want to change mem0**, the architecture must change. Three real alternatives, each with trade-offs:

| Alternative | What changes | Trade-off |
|---|---|---|
| **A. Cloudflare Worker auth-proxy** (already in `docs/operator-checklist.md` as Sprint 2) | New ~50-line Worker. mem0 untouched. SPA hits Worker for `/auth/google`, Worker mints session, Worker proxies mem0 calls (or signs them with `ADMIN_API_KEY`). | One more service to deploy/maintain. Cloudflare account required. Adds latency hop. |
| **B. Use mem0's existing dashboard auth** (it has email/password + JWT already) | Zero mem0 code changes. SPA uses mem0's `/auth/login` endpoint instead of Google. | **No Google sign-in.** Defeats the whole point. |
| **C. Stay on localStorage** | Nothing. | No real verification, no cross-device. The bugs we already fixed (PR #18, #20) are the best we can do without server help. |
| **D. Third-party auth service** (Clerk, Auth0, Supabase Auth, etc.) | Adopt their SDK. mem0 untouched. | External dependency, paid tiers, vendor lock-in. |

**My recommendation if "no mem0 changes" is a hard constraint:** option A (Cloudflare Worker). The docs already plan for this; it's the documented Sprint 2.

**My recommendation if "minimum total surface area" is the goal:** the original plan (mem0 changes). 4 files, ~250 lines, one PR, one redeploy. Most of the code is already pushed (see below).

## Exact state of the code right now

### `oznakash/mem0`, branch `claude/server-auth`

**3 commits pushed, NOT yet opened as a PR:**

| Commit | What | File(s) |
|---|---|---|
| `464ca3e` | Add `google-auth>=2.30,<3.0` dep | `server/requirements.txt` |
| `c155913` | Google JWT verify + session JWT mint/decode + `verify_auth` recognizes session JWTs | `server/auth.py` |
| `0b8d0de` | New router with `POST /auth/google`, `GET /auth/me`, `POST /auth/signout` | `server/routers/google_auth.py` |

**1 commit NOT yet pushed (next step in Phase 1 if resuming the original plan):**

- `server/main.py` — needs to:
  - Add `from routers import google_auth as google_auth_router`
  - Add `app.include_router(google_auth_router.router)` after the existing routers
  - Replace single-origin CORS with multi-origin via env var:
    ```python
    CORS_ORIGINS = [o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()]
    allow_origins = list({DASHBOARD_URL, *CORS_ORIGINS})
    app.add_middleware(CORSMiddleware, allow_origins=allow_origins, ...)
    ```

**No PR opened on mem0.** Code is sitting on the branch.

### `oznakash/learnai`, branch `claude/server-auth`

**1 commit pushed, draft PR #21 open:**

| Commit | What | File(s) |
|---|---|---|
| `eb1cd69` | Phase 0 plan doc | `docs/server-auth-plan.md` |
| (this commit) | Phase 1 handoff doc (pause state) | `docs/server-auth-handoff.md` (this file) |

**No code changes pushed to LearnAI yet.** The plan in `server-auth-plan.md` lists 7 files to change (auth/server.ts, types.ts, defaults.ts, AdminConfigTab.tsx, SignIn.tsx, PlayerContext.tsx, AdminContext.tsx) plus a new INSTALL.md. None done.

### Other branches with related dangling work

- `oznakash/learnai` `claude/install-mem0-setup-4uJBC-v3` — 4 commits with the older "move Client ID to Admin localStorage" approach. **Superseded** by the env-var approach in this plan; can be deleted. No PR open.
- `oznakash/learnai` `claude/install-mem0-setup-4uJBC-v2` — used for the merged PR #20; can be deleted.
- `oznakash/learnai` `claude/install-mem0-setup-4uJBC` — used for the merged PR #18; can be deleted.

## Decision points awaiting user input

The session was paused before these were resolved. A future session should ask the user (or check chat history) for direction on:

1. **Which architecture: A (mem0 changes), Cloudflare Worker, third-party, or stay on localStorage?**
   - User explicitly asked for "server side." Options A and "Cloudflare Worker" both deliver that. mem0 is faster to ship; Worker has cleaner separation.
2. **If the user picks the original mem0 architecture, push `main.py` next** — the only file remaining for Phase 1. ~30 lines of changes.
3. **If the user picks Cloudflare Worker**, the mem0 commits already on `claude/server-auth` should be **discarded** (force-push the branch to main HEAD or close it without merging). The Worker work starts fresh in a new repo or a `worker/` subdir of LearnAI.

## How to resume — by architecture choice

### Resume "original plan" (mem0 changes)

1. Read [`server-auth-plan.md`](./server-auth-plan.md) Phases 1-4.
2. Push the `main.py` change described above to `oznakash/mem0` `claude/server-auth`.
3. Open PR on `oznakash/mem0` from `claude/server-auth` → `main`.
4. Once mem0 PR is merged + redeployed (CloudClaude rebuilds image, env vars set), proceed to Phase 2 (LearnAI client).
5. Update `server-auth-plan.md` status table on each phase commit.

### Resume "Cloudflare Worker"

1. Discard the dangling mem0 commits on `claude/server-auth` (close branch or force-reset to main).
2. Decide where the Worker code lives — same repo or new repo. (LearnAI's `app/worker/` is a reasonable place for an open-source-friendly fork.)
3. Worker contract:
   - `POST /auth/google` — verify Google ID token, mint session JWT (signed with a Worker-side secret), return.
   - `GET /auth/me` — verify session JWT, return claims.
   - `*` other routes — proxy to mem0 with `Authorization: Bearer <ADMIN_API_KEY>` injected (Worker holds the admin key, browsers don't).
4. Wire the Worker as the public mem0 endpoint; mem0 itself becomes private (only Worker can reach it).
5. SPA points at the Worker URL instead of mem0 directly. The session JWT flow on the SPA side is identical to the original plan.
6. Add a Cloudflare-Worker section to `INSTALL.md`.

### Resume "stay on localStorage"

1. Discard the `claude/server-auth` branch on both repos.
2. Close the tracking PR (#21).
3. Document the limitations honestly in `docs/operator-checklist.md`.

## Env vars by architecture

For the **mem0 architecture**, these go on the mem0 service env on CloudClaude:

```
GOOGLE_OAUTH_CLIENT_ID=<your-client-id>.apps.googleusercontent.com
ADMIN_EMAILS=oznakash@gmail.com
CORS_ORIGINS=https://learnai.cloud-claude.com,https://learnai-b94d78.cloud-claude.com,http://localhost:5173
SESSION_TTL_DAYS=7
```

And on the LearnAI service env:

```
VITE_MEM0_URL=https://mem0-09b7ea.cloud-claude.com
VITE_GOOGLE_CLIENT_ID=<your-client-id>.apps.googleusercontent.com
VITE_SERVER_AUTH_DEFAULT=production
```

For the **Cloudflare Worker** architecture, vars are split between Worker (server-side secrets) and LearnAI service (build-time, public-safe). See plan doc for the same SPA-side vars.

## Status table (mirror of server-auth-plan.md)

| Phase | What | State |
|---|---|---|
| 0 | Planning doc + tracking PR | ✅ Phase 0 commit landed on `claude/server-auth` |
| 1 | mem0 server: Google JWT verify + session JWT mint | ⏸ **PAUSED**. 3/4 commits pushed, 1 file (`main.py`) remaining. PR not opened. |
| 2 | LearnAI client: mode toggle + server sign-in | ⏸ Blocked on Phase 1 + architecture decision |
| 3 | INSTALL.md at repo root | ⏸ Blocked on architecture decision |
| 4 | Integration verification + merge both PRs | ⏸ Blocked |

## Pre-existing PRs (not part of this work, for context)

These are merged and live in production already; the server-auth work builds on top of them:

- `oznakash/mem0#1` — psycopg[binary] (container boot fix)
- `oznakash/mem0#2` — JWT_SECRET auto-gen
- `oznakash/mem0#3` — auto-create history dir + auto-CREATE-EXTENSION pgvector
- `oznakash/mem0#5` — LearnAI compat shim (`/v1/memories/*`, Bearer ADMIN_API_KEY) + alembic on boot
- `oznakash/learnai#18` — localStorage write-race fix
- `oznakash/learnai#20` — SignIn form vanishing on first keystroke

`oznakash/mem0#4` was closed without merging due to history conflicts — replaced by #5 (same content, fresh branch).

## What I'd ship if I had to pick (no user override)

I'd take the **original mem0 architecture** to closure: push the remaining `main.py` change to mem0, open the PR, merge, then Phase 2 LearnAI work. Reasoning:

1. The expensive part (Google JWT verify + session mint + auth integration) is already written and pushed to the branch. ~250 lines of Python sitting idle.
2. Cloudflare Worker is a cleaner long-term architecture but doubles the surface area to ship today (Worker code + LearnAI changes).
3. Single-tenant single-deploy is the current threat model. A Worker buys multi-tenant safety we don't yet need.
4. If we ever do go multi-tenant, the Worker fits in front of mem0 without changing this work — it's additive, not exclusive.

This recommendation is for the next session to consider. **Final call rests with the user.**
