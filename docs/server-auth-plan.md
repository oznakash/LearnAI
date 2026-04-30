# Production Auth — Implementation Plan & Status

> **Shipped.** This doc is the post-mortem and architecture record. The original plan, the as-built deltas, and the decisions log are all here.
> If you're picking up future work, the things to know are in **Status** + **As-built deltas from the original plan** + **Decisions log**.

## Status

| Phase | What | State |
|---|---|---|
| 0 | Planning doc + tracking PR | ✅ shipped |
| 1 | mem0 server: Google JWT verify + session JWT mint | ✅ shipped (oznakash/mem0#6) |
| 2 | LearnAI client: mode toggle + server sign-in | ✅ shipped (this PR) |
| 3 | INSTALL.md at repo root | ✅ shipped (this PR) |
| 4 | Integration verification + merge both PRs | ✅ shipped |

## Goal

Move LearnAI from per-browser localStorage auth to **server-verified Google sign-in with 7-day sessions**. Keep a "demo mode" toggle so anyone forking the repo gets a working app out of the box without any server setup. Bake in safe public defaults (mem0 URL, Google Client ID) so the operator doesn't re-enter them. **Never** put secrets (OpenAI key, mem0 admin key) in the public repo or browser bundle.

## Architecture

```
   Browser (LearnAI SPA, static)
       │
       │ 1. Google ID token (from GIS)
       ▼
   POST /auth/google  ──►  mem0 server
                              │
                              │ 2. Verify ID token against Google's certs
                              │    (audience = GOOGLE_OAUTH_CLIENT_ID)
                              │ 3. Check email against ADMIN_EMAILS allowlist
                              │ 4. Mint a 7-day session JWT signed with JWT_SECRET
                              │
                              ▼
   Browser stores session JWT
       │
       │ Authorization: Bearer <session-jwt>
       ▼
   GET /auth/me, GET /v1/memories/, etc.
       │
       ▼
   mem0 server validates session JWT on every request
```

No new service. mem0's existing FastAPI + Postgres + JWT machinery does all the work.

## As-built deltas from the original plan

The implementation matched the plan with three small adjustments worth recording:

1. **Session probe path renamed `GET /auth/me` → `GET /auth/session`.** The dashboard auth router (`server/routers/auth.py`) already owns `/auth/me`. Rather than reorder routers, the new endpoint takes a non-colliding path and the SPA points at it. Same applies to `POST /auth/signout` → `POST /auth/google/signout`.
2. **`AdminConfig.serverConfig` was named `AdminConfig.serverAuth`** with `{ mode, googleClientId, mem0Url }` — same shape, more consistent name.
3. **Hardcoded fallbacks for source-rebuilt deploys.** Cloud-Claude rebuilds the SPA on its own infra and ignores both the committed `/dist/` directory and the GitHub Actions repository variables. So `defaults.ts` carries `FALLBACK_SERVER_AUTH_MODE = "production"` and `FALLBACK_MEM0_URL = "https://mem0-09b7ea.cloud-claude.com"` as a second layer below the `VITE_*` env-var defaults. Forks override either layer to opt into demo. (See `app/src/admin/defaults.ts` for the precedence order.)
4. **Per-browser → admin-config Client ID migration.** The pre-existing `PlayerState.googleClientId` from demo-era sessions auto-promotes into `AdminConfig.serverAuth.googleClientId` on first production-mode load, so an operator who already had a working Client ID on the device doesn't have to paste it again.

## Phase 1 — mem0 server (`oznakash/mem0`, branch `claude/server-auth` — merged as #6)

### Files to change

| File | Change |
|---|---|
| `server/requirements.txt` | Add `google-auth>=2.0,<3.0` |
| `server/auth.py` | Add `verify_google_id_token()`, `issue_session_token()`, `decode_session_token()`. Modify `verify_auth` to recognize session JWTs distinctly from admin keys. |
| `server/routers/google_auth.py` (new) | `POST /auth/google` — accept `{id_token}`, verify, return `{session, user, is_admin, expires_at}`. `GET /auth/me` — return current user from session. `POST /auth/signout` — best-effort (sessions are stateless JWTs; this is just a UX hint). |
| `server/main.py` | `include_router(google_auth_router)`. Read `GOOGLE_OAUTH_CLIENT_ID`, `ADMIN_EMAILS`, `CORS_ORIGINS`, `SESSION_TTL_DAYS=7`. Configure CORS middleware with the allowlist. |

### New env vars on the mem0 service (CloudClaude)

| Var | Value | Purpose |
|---|---|---|
| `GOOGLE_OAUTH_CLIENT_ID` | `<your client id>.apps.googleusercontent.com` | Audience for ID-token verification (the `aud` claim) |
| `ADMIN_EMAILS` | `oznakash@gmail.com` | Comma-separated allowlist; emails on this list become admins |
| `CORS_ORIGINS` | `https://learnai.cloud-claude.com,https://learnai-b94d78.cloud-claude.com,http://localhost:5173` | Browser origins allowed to call mem0 API |
| `SESSION_TTL_DAYS` | `7` | Session JWT lifetime |

`OPENAI_API_KEY`, `JWT_SECRET`, `ADMIN_API_KEY`, `POSTGRES_*` — all already set, untouched.

### Endpoint contracts (as shipped)

`POST /auth/google` (no auth required)
```
Request:  { "id_token": "<google jwt>" }
Response: 200 OK
  {
    "session": "<our jwt, signed with JWT_SECRET>",
    "user": { "email": "...", "name": "...", "picture": "..." },
    "is_admin": true,
    "expires_at": 1719500000
  }
  401 if ID token invalid
  403 if email not @gmail.com (preserve existing Gmail-only policy)
```

`GET /auth/session` (session bearer required) — renamed from `/auth/me` to
avoid colliding with the dashboard auth router's existing `/auth/me`.
```
Response: 200 OK
  { "email": "...", "name": "...", "is_admin": true, "expires_at": 1719500000, "auth_type": "google_session" }
  401 if session missing/expired/invalid
```

`POST /auth/google/signout` (session bearer required)
```
Response: 200 OK
  (Stateless JWTs — server doesn't track. Client discards. Documented as "client-side")
```

### How `verify_auth` recognizes which kind of credential

Order:
1. `Authorization: Bearer <jwt>` where `jwt` matches `ADMIN_API_KEY` (constant-time) → admin path (already in PR #5)
2. `Authorization: Bearer <jwt>` where `jwt` is a session JWT (decode + verify against `JWT_SECRET`) → user from session
3. `Authorization: Bearer <jwt>` where `jwt` is a JWT issued by mem0's existing dashboard login flow → existing path
4. `X-API-Key` → existing path

Session JWT distinguishing claim: `type: "session"` (vs the existing `type: "access"`). Different validation rules so we don't mix them up.

## Phase 2 — LearnAI client (`oznakash/learnai`, branch `claude/server-auth`)

### Files to change

| File | Change |
|---|---|
| `app/src/auth/server.ts` (new) | `signInWithServer(idToken)`, `getStoredSession()`, `signOut()`. Stores session in localStorage with expiry. Validates expiry on read. |
| `app/src/admin/types.ts` | Add `flags.serverAuthMode: "demo" \| "production"` and `serverConfig: { mem0Url: string; googleClientId: string; }` |
| `app/src/admin/defaults.ts` | Default `serverAuthMode` from `import.meta.env.VITE_SERVER_AUTH_DEFAULT` (fall back to `"demo"`). Default `mem0Url` from `VITE_MEM0_URL`. Default `googleClientId` from `VITE_GOOGLE_CLIENT_ID`. |
| `app/src/admin/AdminConfigTab.tsx` | New "Authentication" section: mode toggle, mem0 URL, Google Client ID. The OpenAI key is **not** a field — that's mem0-server-side only. |
| `app/src/views/SignIn.tsx` | Branch on mode. Production → call `/auth/google` after GIS flow. Demo → current local-only flow. |
| `app/src/store/PlayerContext.tsx` | On hydrate, validate session expiry. Clear identity if expired. New `signOut()` calls server then clears local. |
| `app/src/admin/AdminContext.tsx` | When in production mode, derive `isAdmin` from session JWT's `is_admin` claim, not from the local allowlist. |

### New env vars on the LearnAI service (CloudClaude)

| Var | Value | Purpose |
|---|---|---|
| `VITE_MEM0_URL` | `https://mem0-09b7ea.cloud-claude.com` | Default mem0 endpoint |
| `VITE_GOOGLE_CLIENT_ID` | `<your client id>.apps.googleusercontent.com` | Default Google Client ID |
| `VITE_SERVER_AUTH_DEFAULT` | `production` | New deployments default to server auth (forks default to demo) |

These are baked into the JS bundle at build time. Public values only — safe.

### Demo mode (preserved for forkers)

When `serverAuthMode === "demo"`:
- No call to `/auth/google` — sign in with local-only identity (just an email string)
- No session JWT — identity persists in localStorage as today
- mem0 calls (if configured) use the legacy admin-bearer flow
- Useful for: someone clones the repo + runs locally with no server

When `serverAuthMode === "production"`:
- Google sign-in → `/auth/google` → session JWT
- All mem0 calls use the session JWT
- Cross-device sign-in works (same Google account → new session per browser)
- 7-day expiry; after that, re-auth required

## Phase 3 — INSTALL.md (`oznakash/learnai`, repo root)

New top-level file. Sections:

1. **Two flavors of install** — demo (5 min, no server) vs production (30 min, full stack)
2. **Demo install** — clone, `npm install`, `npm run dev`. Done.
3. **Production install** — step-by-step:
   1. Provision Postgres+pgvector (link to existing `docs/mem0.md` if applicable, or fresh CloudClaude steps)
   2. Provision the mem0 service (image, env vars listed in this plan)
   3. Provision Google OAuth Client ID (Cloud Console, authorized origins)
   4. Provision the LearnAI service (env vars listed in this plan)
   5. Verify (smoke tests, hit `/health`, sign in)
4. **Operations** — rotate secrets, add admins, upgrade mem0, troubleshooting
5. **Architecture link** — point at this plan + `docs/architecture.md`

## Phase 4 — Integration + merges

1. Merge mem0 PR → CloudClaude rebuilds mem0 → endpoints live
2. Merge LearnAI PR → GitHub Actions rebuilds `/dist/` → CloudClaude serves new SPA
3. Operator (you) sets the new env vars on both services + redeploys
4. Smoke test: hard-refresh LearnAI → see Google sign-in button → click → land in app → reload → still signed in
5. Cross-device test: sign in on phone, sign out, sign in on laptop — both should work

## Decisions log

- **Session as JWT, not server-tracked session table.** Stateless, fewer DB reads, simpler. Trade-off: revoking a session before it expires requires keeping a denylist (we won't bother for v1).
- **7-day expiry, no sliding refresh.** User said "1 week"; reauth at 7 days is simple and explicit. Sliding refresh adds complexity for marginal UX win.
- **Admin allowlist via env var, not DB.** ADMIN_EMAILS is comma-separated. Trade-off: changing admins requires a redeploy. For a single-operator tool that's fine; later we move to a DB-backed list.
- **Production is the baked default for source-built deploys.** Cloud-Claude rebuilds from source without picking up GitHub repository variables, so a "demo by default + production via env var" setup left the production deploy in demo mode after PR #21. The fix flipped the source-level fallback to production with the operator's mem0 URL hardcoded. Forks set `VITE_SERVER_AUTH_DEFAULT=demo` at build time, or flip the toggle in the Admin UI.
- **No bake-in of OPENAI_API_KEY or ADMIN_API_KEY.** Public repo + bundled JS = leak. These stay as mem0-service env vars only.
- **`VITE_MEM0_URL` + `VITE_GOOGLE_CLIENT_ID` baked is safe.** URLs and Client IDs are public by design.
- **mem0 calls in production use the session JWT as bearer.** `selectMemoryService` accepts a `bearerToken` override that the SPA passes from React state directly, instead of having `getRuntimeMemoryConfig` chase localStorage. This eliminates a render-vs-write race that would have given the rebuilt service a stale token for one render after sign-in. `ADMIN_API_KEY` never reaches the browser.
- **`is_admin` is server-signed.** AdminContext derives admin status from the session JWT's `is_admin` claim in production mode (sourced from mem0's `ADMIN_EMAILS`), and from the local allowlist in demo mode. The local allowlist is now demo-only.
- **Session expiry validated on hydrate.** `PlayerContext` drops an expired `serverSession` (and the identity that came with it) before any UI renders, so a returning user with a stale token sees the sign-in card instead of a broken signed-in app.

## Open risks

- **Google ID token verification cost.** Each verify hits Google's JWKS endpoint to fetch certs. The `google-auth` lib caches them — should be fine. Worst case: ~50ms per sign-in (one-time per session), negligible.
- **CORS during local dev.** Adding `http://localhost:5173` to CORS_ORIGINS is fine. If the operator forks and changes the SPA URL, they update the env var.
- **JWT_SECRET rotation.** When rotated, all existing sessions invalidate. That's the correct behavior — users re-sign-in. Not a bug.
- **mem0's existing `/auth` router (dashboard login).** We're adding `/auth/google` alongside it. Different code path, no conflict expected. Will verify.

## How to resume future work

The original plan is complete. For follow-on work:

- **Adding admins** — `ADMIN_EMAILS` env var on mem0, redeploy. No code change. Existing sessions keep their old `is_admin` claim until they re-sign-in.
- **Rotating `JWT_SECRET`** — replace on mem0, redeploy. All active sessions invalidate; users re-sign-in. Use as nuclear option.
- **Adding a second deployment / origin** — append to `CORS_ORIGINS` on mem0, redeploy. SPA-side: set `VITE_GOOGLE_CLIENT_ID` and `VITE_MEM0_URL` at build time, or override in Admin → Authentication.
- **Per-session revocation** — would require a denylist table; out of scope for v1, deliberately deferred. Sessions are stateless 7-day JWTs.
- **Multi-tenant** — would benefit from a Cloudflare Worker proxy (the alternative architecture in `docs/server-auth-handoff.md`). Additive — fits in front of mem0 without changing this work.

If you're a Claude Code session resuming any of this:

1. Confirm git state on both repos: `oznakash/learnai` and `oznakash/mem0`. The shipped version is everything ≤ #6 on mem0 / ≤ #23 on LearnAI.
2. Read this doc + `INSTALL.md` to understand the full picture.
3. Update this doc on every architecture change so the next session has a current map.

## Cross-references

- Architecture (high-level): `docs/architecture.md`
- mem0 self-hosting: `docs/mem0.md`
- Operator checklist: `docs/operator-checklist.md`
- This plan: `docs/server-auth-plan.md` (you're reading it)

---

**Last updated:** Phase 0 commit, this branch HEAD.
