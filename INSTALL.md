# Installing LearnAI

Two flavors, depending on what you want.

| Flavor | Time | What you need | What you get |
|---|---|---|---|
| **Demo** | ~5 min | Just the repo | A static SPA running locally with localStorage-only sign-in. No server. Forks default to this. |
| **Production** | ~30 min | Postgres+pgvector, mem0 image, Google OAuth client, a static host | Real server-verified Google sign-in, 7-day sessions across devices, the cognition layer wired up. |

If you're just trying LearnAI out — start with demo. The production path is for someone running it as a network for other people.

---

## Demo install

```sh
git clone https://github.com/oznakash/LearnAI.git
cd LearnAI
npm install
npm run dev
```

That's it — `http://localhost:5173` will load the SPA. On the sign-in screen, paste any Google OAuth Client ID (or use the "Skip OAuth setup" demo button with a Gmail address). Progress lives in localStorage; nothing leaves your browser.

---

## Production install

Five steps. Everything is on cloud infra you already operate; no LearnAI-specific service.

### 1. Provision Postgres with pgvector

Any Postgres that supports the `vector` extension works (Supabase, Neon, RDS, your own). On CloudClaude:

- Provision a `postgres-pgvector` service.
- Note the host, port, db name, user, and password.

mem0's first boot calls `CREATE EXTENSION IF NOT EXISTS vector;` itself, so you don't need to run it manually as long as the connecting user has the `CREATE EXTENSION` privilege.

### 2. Provision mem0

Deploy [`oznakash/mem0`](https://github.com/oznakash/mem0)'s `main` branch (the LearnAI fork). The Dockerfile + alembic boot is already self-contained.

Required env vars on the mem0 service:

| Var | Example | Why |
|---|---|---|
| `POSTGRES_HOST` | `cc-...:5432` | Connection target |
| `POSTGRES_PORT` | `5432` | |
| `POSTGRES_DB` | `app` | |
| `POSTGRES_USER` | `postgres` | |
| `POSTGRES_PASSWORD` | `<value>` | |
| `OPENAI_API_KEY` | `sk-...` | Embeddings + extraction |
| `JWT_SECRET` | `openssl rand -base64 48` | Signs session JWTs. Set once and keep — rotating invalidates every active session. |
| `ADMIN_API_KEY` | `openssl rand -base64 48` | Operator break-glass; never ships to the browser. |
| `GOOGLE_OAUTH_CLIENT_ID` | `<id>.apps.googleusercontent.com` | Audience for ID-token verification. |
| `ADMIN_EMAILS` | `you@gmail.com` | Comma-separated allowlist. Emails on this list get `is_admin: true` claims in their session JWT. |
| `CORS_ORIGINS` | `https://learnai.cloud-claude.com,http://localhost:5173` | Comma-separated browser origins allowed to reach the API. |
| `SESSION_TTL_DAYS` | `7` | Optional. Defaults to 7. |
| `HISTORY_DB_PATH` | `/app/data/history.db` | Optional. **Mount a persistent volume at `/app/data`** so the memory-history audit trail survives rebuilds. Setting this to `/tmp/...` makes the audit trail ephemeral (memories themselves remain safe in Postgres regardless). |

After redeploy, smoke:

```sh
curl https://<your-mem0>/health                # → {"status":"ok"}
curl https://<your-mem0>/openapi.json | jq '.paths | keys[]' | grep '^"/auth/\|^"/v1/state'
# expect to see: "/auth/google", "/auth/session", "/auth/google/signout",
#                "/auth/config", "/v1/state"
```

### 3. Provision a Google OAuth client

1. https://console.cloud.google.com → APIs & Services → Credentials → Create OAuth client ID → Web application.
2. **Authorized JavaScript origins**: add every URL the SPA will run on (`https://learnai.cloud-claude.com`, `http://localhost:5173` for local dev, etc.).
3. Copy the Client ID — it ends in `.apps.googleusercontent.com`. You'll feed this into LearnAI in step 4.

You don't need a client secret — LearnAI uses the GIS browser flow, not the OAuth Authorization Code flow.

### 4. Provision LearnAI

LearnAI is a static SPA — `npm run build` produces `/dist/` which any nginx, Netlify, Vercel, S3+CloudFront, or CloudClaude static service can serve.

In the GitHub repo, set three repository **variables** (not secrets — these are public values baked into the bundle):

| Variable | Value |
|---|---|
| `VITE_SERVER_AUTH_DEFAULT` | `production` |
| `VITE_MEM0_URL` | `https://<your-mem0>` |
| `VITE_GOOGLE_CLIENT_ID` | `<your-client-id>.apps.googleusercontent.com` |

```sh
gh variable set VITE_SERVER_AUTH_DEFAULT --body production --repo <owner>/LearnAI
gh variable set VITE_MEM0_URL --body https://<your-mem0> --repo <owner>/LearnAI
gh variable set VITE_GOOGLE_CLIENT_ID --body '<id>.apps.googleusercontent.com' --repo <owner>/LearnAI
```

Push to `main` (or run the `Build & publish /dist` workflow manually). The action rebuilds `/dist/` with these defaults baked in. Static-mirror deployers redeploy themselves.

If you're running outside GitHub Actions, set the same env vars before `npm run build`.

### 5. Verify

1. Hard-refresh the SPA. Open DevTools → Application → Local Storage → confirm there's no stale data, or sign out and clear it.
2. The sign-in card should show the Google "Continue with" button immediately. Click it.
3. Network panel: a `POST` to `<your-mem0>/auth/google` should return `200` with `session`, `user`, `is_admin`, `expires_at`.
4. Reload — you should still be signed in (session JWT lives in localStorage with a 7-day TTL).
5. Open `/admin` (only visible to emails on `ADMIN_EMAILS`). The Authentication section should show `mode: production` and the URL/Client ID prefilled.

### Cross-device test

1. Sign in on browser A. Earn some XP (complete a Spark or two).
2. Sign in on browser B with the same Gmail. Within ~1 second of sign-in, browser B should show the same XP, streak, history, profile, and badges as browser A.
3. Earn more XP on B. Switch to A and refresh — B's progress shows up on A within ~1 second.
4. Sign out on A. B is unaffected (sessions are stateless 7-day JWTs, no server-side revocation).
5. Memory ("/memory" tab) is shared the same way — it's stored on the mem0 server keyed on the same email.

The cross-device sync uses `GET / PUT /v1/state` on mem0 (per-user JSON blob, capped at 256 KB). Per-device fields — the session token, the local Anthropic/OpenAI API key, and demo-mode Client ID — never leave the device.

---

## Operations

### Add or remove an admin

Edit `ADMIN_EMAILS` on the mem0 service env, redeploy. Existing sessions keep their old `is_admin` claim until they re-sign-in.

### Rotate `JWT_SECRET`

Replace the env var on mem0, redeploy. Every active session is invalidated; users re-sign-in. Use this as the nuclear option — there's no per-session revocation.

### Upgrade mem0

`oznakash/mem0`'s `main` is the LearnAI fork. Pull and redeploy your image. Migrations run automatically on container boot.

### Persistence checklist (what survives a rebuild)

| Data | Where it lives | Survives mem0 rebuild |
|---|---|---|
| Memories (vector + payload) | Postgres + pgvector | ✅ Yes — separate service |
| User accounts, API keys, sessions table, request logs | Postgres | ✅ Yes |
| Cross-device PlayerState (XP, streak, history, profile, …) | Postgres `user_states` | ✅ Yes |
| `JWT_SECRET` (active session validity) | Env var on the mem0 service | ✅ Yes |
| `GOOGLE_OAUTH_CLIENT_ID`, `ADMIN_EMAILS`, `CORS_ORIGINS` | Env vars | ✅ Yes |
| mem0 history audit trail (`HISTORY_DB_PATH`) | Wherever you point it | ⚠️ **Only if you mount a persistent volume**. The default is `/app/data/history.db`; mount a volume at `/app/data` (or override `HISTORY_DB_PATH` to a known persistent path). |
| Per-browser AdminConfig (branding, flags, tuning) | Browser localStorage | Per-device today; sync follows in a later sprint. |

### Troubleshoot

- **Sign-in returns 403 "Only @gmail.com addresses are allowed"** — by design. The SPA + server both enforce this.
- **Sign-in returns 500** — check `GOOGLE_OAUTH_CLIENT_ID` is set on the mem0 service. The verifier 500s with a clear message when it's missing.
- **CORS errors in the browser console** — add the SPA's origin to `CORS_ORIGINS` (comma-separated) and redeploy mem0.
- **Stuck signed in but mem0 calls 401** — your session JWT outlived `JWT_SECRET`. Sign out and back in.

---

## Architecture quick map

- `docs/architecture.md` — the boxes-and-arrows view.
- `docs/server-auth-plan.md` — the original plan that produced the current sign-in code.
- `docs/mem0.md` — self-hosting mem0 in detail.
- `oznakash/mem0` `server/auth.py` + `server/routers/google_auth.py` — server-side sign-in implementation.
- `app/src/auth/server.ts` — SPA-side helpers.
- `app/src/admin/runtime.ts` — how the SPA decides which mem0 URL + bearer to use at runtime.
