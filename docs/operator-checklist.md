# LearnAI — Operator Checklist

> _Everything an operator needs to take LearnAI from "great demo" to "real product." Setup steps, current capabilities, gaps, risks, and a hard definition of "production-ready."_

The full SPA is **shipped, tested (165/165 vitest + 4 mem0 build tests + 5 deploy smoke checks), and deployable today**. The production stack at `learnai.cloud-claude.com` is end-to-end: server-verified Google sign-in, cross-device PlayerState sync, Postgres-backed cognition, single-DB persistence (no volume mounts needed). The post-MVP roadmap is now growth + differentiation, not foundations.

---

## 🛠 What needs to be done to make it work

| # | Step | Who does it | Time | Cost |
|---|---|---|---|---|
| 1 | **Provision Google OAuth Client ID.** Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client (Web). Authorized origins: prod URL + `http://localhost:5173`. No client secret needed (browser flow). | Owner | ~10 min | Free |
| 2 | **Provision Postgres + pgvector.** Cloud-Claude provides this as a managed service; alembic auto-runs all eight migrations on first mem0 boot. | Owner | ~5 min | ~$5–15/mo |
| 3 | **Deploy mem0.** Cloud-Claude image from `oznakash/mem0:main`. Set the env vars from [`INSTALL.md`](../INSTALL.md#2-provision-mem0): `POSTGRES_*`, `OPENAI_API_KEY`, `JWT_SECRET`, `ADMIN_API_KEY`, `GOOGLE_OAUTH_CLIENT_ID`, `ADMIN_EMAILS`, `CORS_ORIGINS`, `SESSION_TTL_DAYS=7`. | Owner | ~10 min | ~$5/mo idle; ~$0.20/user/year in OpenAI extraction |
| 4 | **Smoke the deploy.** `npm run smoke:deploy` (5 checks, 1 second, no auth). Confirms `/health`, `/auth/*`, `/v1/state` are live + CORS + the SPA bundle has the right URL baked in. | Owner | ~5 sec | — |
| 5 | **(Optional) Bake the Client ID at build time.** `gh variable set VITE_GOOGLE_CLIENT_ID --body '<id>.apps.googleusercontent.com' --repo <owner>/LearnAI`. Skipped is fine — the SPA self-heals via `/auth/config` on first load. | Owner | ~1 min | — |
| 6 | **Sign in once + verify.** Open the production URL → sign in with Google → confirm you reach Home (not Onboarding loop). Check **Admin → Memory → Currently active** says "🧠 Online" with `mem0` backend. | Owner | ~30 sec | — |
| 7 | (Optional) **Configure email provider** in Admin → Emails. Resend / SMTP-relay-webhook / EmailJS work browser-side; Postmark/SendGrid/SES need a server-side relay. | Admin | ~5 min | Provider-dependent |
| 8 | (Optional) **Custom domain + TLS** for both the SPA and mem0. Required if you want `learnai.com` instead of the Cloud-Claude default subdomain. | Owner | ~30 min | Domain registrar |

After step 6 the product is real: users sign in with their Gmail, sessions last 7 days across devices, memory persists in Postgres, and a fresh-browser visit auto-bootstraps the Client ID without any operator intervention.

Backup recipe for everything stateful: a nightly `pg_dump` of the Postgres service. Restore = restart mem0 against the restored DB. Memories, audit trail, sessions, and per-user state come back as one unit.

---

## ✅ Capabilities shipped today

| Capability | What it does | Status |
|---|---|---|
| **Curriculum** | 12 Topics × 10 levels × 4–6 Sparks ≈ **480 hand-authored micro-lessons**. 8 Spark formats (MicroRead, Tip, Quick Pick, Pattern Match, Fill the Stack, Field Scenario, Build Card, Boss Cell). | ✅ |
| **Onboarding** | 6-step ~90-sec wizard. Age band + skill level + interests + minutes + goal. Recalibration flow (5-Q quiz). | ✅ |
| **Game loop** | XP, Focus (lives, regen 18m), Build Streak, 5 Guild tiers, 14 Badges, anti-spam XP lock. Mascot name + XP unit display name configurable in Admin → Branding. | ✅ |
| **Identity** | Server-verified Google sign-in. SPA hands the ID token to mem0 → mem0 verifies against Google's JWKS → mints a 7-day session JWT signed with `JWT_SECRET`. `is_admin` claim derived from `ADMIN_EMAILS`. Demo mode preserved for forks running without a backend. | ✅ |
| **Fresh-browser auto-bootstrap** | `GET /auth/config` returns the operator's public Client ID. SPA self-heals on first load from any device — no manual paste. | ✅ |
| **Cognition layer** | On by default for every signed-in user. `MemoryService` interface, `OfflineMemoryService` (per-device fallback) + `Mem0MemoryService` (HTTP). Event hooks for goals, calibration, strengths, gaps, history, and now every Spark completion. | ✅ |
| **"Your Memory" tab** | List / filter / edit / forget / wipe / export. Read-write parity. Empty-state guidance for new users. | ✅ |
| **Cross-device PlayerState sync** | `GET / PUT /v1/state` + Postgres `user_states` table. SPA loads on sign-in / hydrate, debounced PUT on every mutation. Per-device fields (session JWT, local API key, demo Client ID) stripped before send. 256 KB cap. | ✅ |
| **Persistence on rebuild** | `PostgresHistoryManager` swaps mem0's stock SQLite history for Postgres at boot. Memories, audit trail, sessions, accounts, and per-user state all in one DB. Container rebuilds lose nothing. No volume mounts needed. | ✅ |
| **Per-user privacy opt-out** | When admin flips `flags.memoryPlayerOptIn` on, players see a "Let LearnAI remember things about me" toggle in Settings. Default is off; cognition is on for everyone. | ✅ |
| **Tasks tab** | YouTube/article/Build-Card capture; statuses, filters, 1-tap "Copy prompt" for Claude Code. | ✅ |
| **Dashboards** | Per-topic ring/bars/sparkline + global radar/heatmap/badges grid + 12-week heatmap. | ✅ |
| **Admin Console** | 7 tabs: Users · Analytics · Memory · Emails · Tuning · Content · Prompt Studio · Config. Tuning is live-applied. | ✅ |
| **Email lifecycle** | 8 templates with HTML preview. Real send via Resend / SMTP-relay / EmailJS. | ✅ (others need relay) |
| **Deployability** | Static SPA, auto-rebuilt + auto-committed on every push to `main`. Dockerfile, nginx.conf, vercel.json, netlify.toml, static.json. One-command Fly deploy for mem0. | ✅ |
| **Path routing** | HTML5 path routing: refresh on `/dashboard`, `/topic/<id>`, `/play/<id>`, `/admin` keeps you put. | ✅ |
| **Build tests + deploy smoke** | `npm test` (165 vitest), mem0 `pytest server/tests/` (4 structural checks, sub-second), `npm run smoke:deploy` (5 public-endpoint checks, 1 second). All sub-second, all wired to GH Actions. | ✅ |
| **Quality bar** | 165 / 165 vitest + 4 mem0 build tests + 5 deploy smoke checks. ~488 KB JS / ~29 KB CSS gzipped. | ✅ |

---

## ⚠️ Gaps (not shipped) — what's missing for the full vision

| Gap | Why it matters | Why we don't have it | When |
|---|---|---|---|
| **Public profile pages** | The "profile is a living record" promise needs a `/profile/<handle>` shareable URL. | Needs a public-profiles table alongside `user_states` + a recruiter-safe projection (no private memories). | Sprint 2 |
| **Real cohort leaderboard** | Today's leaderboard is local + bot Guild members. | Needs public profiles. | Sprint 2 |
| **Real cross-user analytics** | Admin Analytics overlays the local user on the seeded mock cohort (toggleable per **Admin → Config → Demo data**). | Needs to aggregate real `user_states` rows. | Sprint 2 |
| **Community-contributed Sparks** | The "creators distill the AI internet into Sparks" loop is the core social-network thesis. Today, only admins/maintainers can author. | Needs an AI-assisted review pipeline + maintainer queue + attribution UX. | Sprint 3 |
| **Multi-admin sync** | Admin config (branding, flags, tuning) shared across several admins via `user_states`-style server storage instead of per-browser localStorage. | One-admin-per-deploy is enough today. | Sprint 3 |
| **Talent Match** | The "new LinkedIn for AI" outcome — companies search the behavioral graph for "shipped X with Y in last 90 days." | Needs public profiles + skills index + recruiter view. | Sprint 4 |
| **Verified Build Card completions** | Recruiters need anti-fake signal — signed artifacts (URL → SHA → claim). | Builds on the talent layer. | Sprint 4 |
| **Native mobile shell** | Phone-first habit. PWA → Capacitor → React Native depending on traction. | Web works great on mobile today; gated on retention proof. | Sprint 5 |
| **Voice mode** | Listen + answer for accessibility / commute. | Demand-gated. | Sprint 5 |
| **On-device cognition** | Differentiator vs. any cloud-only competitor; option to run mem0 fully on-device for privacy-strict users. | Smaller models maturing. | Sprint 5 |
| **Localization** | TAM expansion. UI internationalization + Spark localization via Prompt Studio. | Sequenced after mobile. | Sprint 5 |
| **Stripe / billing** | Pro tier, recruiter platform fees, Org seats. | No revenue feature gated yet. | Whenever monetization starts |

### Recently closed (now in the Capabilities table above)

| Closed gap | Shipped via | When |
|---|---|---|
| **Server-verified Google sign-in** (was: bearer key in admin's browser) | `POST /auth/google` issuing 7-day session JWTs signed with `JWT_SECRET`. `is_admin` derived from `ADMIN_EMAILS`. The browser never holds an admin key. | mem0 PRs #6 + #7 |
| **Cross-device PlayerState sync** (was: localStorage per browser) | `GET / PUT /v1/state` on mem0 + `user_states` Postgres table + debounced PUT in `PlayerProvider`. | mem0 #8 + LearnAI #30 |
| **History-DB persistence** (was: SQLite at `/tmp/history.db` lost on rebuild) | `PostgresHistoryManager` swap at boot. No volume mount needed. | mem0 #10 |
| **Fresh-browser auto-bootstrap** (was: manual Client ID paste per browser) | `GET /auth/config` returns the operator's public Client ID; SPA self-heals on first load. | mem0 #7 + LearnAI #29 |
| **Server-side env snapshot** (was: SSH into the container to verify env vars) | `GET /auth/admin/status` (admin-only) + Admin → Memory → Server config (live) panel. | mem0 #9 + LearnAI #31 |
| **Path routing** (was: refresh snapped you back to home) | `app/src/store/router.ts` + `popstate` / `pushState`. | LearnAI #29 |
| **Cognition on by default + per-user opt-out** (was: master kill-switch off by default + race condition) | Cognition always-on for everyone unless admin grants per-user opt-out via `flags.memoryPlayerOptIn`. `selectMemoryService` rewritten as pure-args (no localStorage cache race). | LearnAI #35 |
| **Build tests + post-deploy smoke** (was: AST-parse only) | mem0 server pytest suite (4 checks, sub-second) + `npm run smoke:deploy` (5 checks, 1 second). | mem0 #11 + LearnAI #34 |

---

## 🔒 Risk register (the things that can break)

| Risk | Severity | Mitigation already in place |
|---|---|---|
| mem0 server down | Medium | Pause-mode banner on `/memory` + cognition writes silently degrade to `OfflineMemoryService`. The game still works without memory. |
| `JWT_SECRET` rotation | Medium | All active sessions invalidate; users sign in again. Documented in [`INSTALL.md`](../INSTALL.md). |
| Postgres unavailable | Medium | mem0 returns 5xx; users see the "memory paused" banner; the SPA stays usable. Backup recipe is a nightly `pg_dump`. |
| LLM cost runaway | Low | Per-user daily write cap (default 200/day) configurable in Admin → Memory. |
| Memory drift / wrong facts | Low | "Forget" + "Wipe all" surfaced on every memory. Read-write parity is the privacy ethic. |
| `:latest` mem0 image surprise | Low | Pin to a SHA tag in your image config for prod. |
| Multi-tenant key leakage | Low (was Medium) | Sessions are server-signed JWTs scoped to the bearer's email; `ADMIN_API_KEY` lives only on the mem0 service env, never in the browser. |

---

---

## 📡 Social MVP — deploy + env vars + monitoring

The social layer (Sprint 2 + 2.5) is bundled into the SPA's container as a Node sidecar. **No separate cloud-claude service to register.** When you redeploy `learnai`, the social-svc sidecar comes with it.

### Env vars to set on cloud-claude (LearnAI service)

These go on the **same** service (`learnai`) you're already running, alongside the existing `VITE_*` build-time vars.

| Env var | Required? | Purpose | Where it comes from |
|---|---|---|---|
| `JWT_SECRET` | **Yes** for production | HS256 secret used to verify the session JWT mem0 mints. **Must be the same value mem0 has** — the sidecar verifies tokens minted by mem0. | Same value already on the mem0 service. Copy it. |
| `SOCIAL_ADMIN_EMAILS` | Yes for moderation tab access | Comma-separated emails granted access to `/v1/social/admin/*` (Admin → Moderation tab). | Your own gmail (e.g. `oznakash@gmail.com`). Same shape as mem0's `ADMIN_EMAILS`. |
| `SOCIAL_DB_PATH` | Yes for persistence | File path where social-svc writes its JSON store. Mount a volume here so it survives restarts. | `/data/social.db.json` (the container declares `VOLUME ["/data"]`). |
| `SOCIAL_ALLOWED_ORIGINS` | Optional | Comma-separated CORS origins. Default `*`. Same-origin deployments don't trigger CORS so this rarely matters in production. | Defaults are fine. |
| `SOCIAL_DEMO_TRUST_HEADER` | **Don't set in prod** | When `1`, sidecar accepts `X-User-Email` directly — for local dev / forks. The sidecar refuses to start with this set under `NODE_ENV=production`. | Leave unset. |
| `NODE_ENV` | Yes | Should be `production` on cloud-claude. Enables prod-mode startup checks and refuses `SOCIAL_DEMO_TRUST_HEADER`. | `production` |

**Three new env vars total.** `JWT_SECRET` and `NODE_ENV` you almost certainly have set already.

### Volume mount

The container declares `VOLUME ["/data"]`. Tell cloud-claude to mount a persistent volume there (1 GB is overkill but cheap). Without it, the social store resets on every container rebuild.

### After-deploy admin flips

Once the container is up, sign into `/admin → Config` and toggle:

- `flags.socialEnabled = true`
- `flags.streamEnabled = true`
- `flags.boardsEnabled = true`
- `socialConfig.serverUrl = ""` (leave empty — same-origin is the production default)

That's it. Refresh; the Network tab + Stream tab + Boards view + AdminModeration tab all appear.

### Logs to monitor on cloud-claude

The sidecar emits **structured JSON logs**, one line per event, to stdout. nginx access logs go to stdout too. cloud-claude captures both as part of the standard container log stream.

**Set up alerts on these log shapes:**

| Log message | Severity | What to do |
|---|---|---|
| `{"level":"error","svc":"social-svc","msg":"startup_misconfig"}` | P0 | `JWT_SECRET` is unset — every authenticated request will 401. Fix env vars + redeploy. |
| `{"level":"warn","svc":"social-svc","msg":"jwt_verify_failed"}` (rate > ~10/min sustained) | P1 | Either someone is hitting the API with stolen / expired tokens, or `JWT_SECRET` drifted between mem0 and the sidecar. Confirm both env vars match. |
| `{"level":"warn","svc":"social-svc","msg":"rate_limited"}` (rate > ~100/min) | P1 | Possible brute-force or runaway client loop. Inspect `email_hash`; if it's one user, ban them. |
| `{"level":"warn","svc":"social-svc","msg":"banned_request"}` | P2 | A banned user is still trying. No action unless the count is high. |
| `{"level":"info","svc":"social-svc","msg":"profile_created"}` | informational | New signup. Watch trends, not individual lines. |
| nginx `502 Bad Gateway` on `/v1/social/*` | P0 | The sidecar process died. Container should auto-restart; if not, redeploy. |
| `{"level":"error"...}` from any other source | P1 | Investigate. The sidecar's `log.error` only fires for invariant violations. |

**Email privacy:** the sidecar logs `email_hash` (sha-256, first 8 chars), never raw email. Greppable for support cases without leaking PII.

**Per-request log shape** (so you can build a dashboard):

```json
{"ts":"2026-05-01T...","level":"info","svc":"social-svc","msg":"req",
 "req_id":"r-mzx-abc12","method":"POST","route":"/v1/social/follow/maya",
 "status":201,"ms":12,"email_hash":"a1b2c3d4"}
```

`req_id` is also returned in the response's `x-req-id` header so support can trace from a user complaint to a log line.

### Healthchecks

Two endpoints; cloud-claude can probe either or both:

- `GET /` — nginx + static SPA (existing). 200 = SPA serves.
- `GET /health-social` — proxies to the sidecar's `/health`. 200 = sidecar is alive. Distinguishes "nginx up but sidecar dead" from "all good".

### Rollback

Flip `flags.socialEnabled = false` in `/admin → Config`. The Network / Stream / Boards / Moderation tabs disappear within 30 s. The sidecar keeps running (no harm); the SPA falls back to `OfflineSocialService`.

To roll back the entire container: tell cloud-claude to redeploy the previous tag. The social JSON store on `/data` survives — re-enabling the flag later picks up where it left off.

### Moderation SLA

Reports queue lives in `/admin → Moderation`. Suggested SLA: **respond within 72 h**. Use the Resolve actions: ✓ No action / ⚠ Warn / 🚫 Ban from social / 🚷 Global ban. Audit trail is in `social.db.json`.

---

## 🎯 Definition of "production-ready"

You can call it shipped to real users when **all** of the following are true:

- [x] Google OAuth Client ID is set and a test Gmail user can sign in.
- [x] mem0 is deployed; `npm run smoke:deploy` returns 5/5 green.
- [x] Cognition is on by default for everyone; the SPA → mem0 round-trip writes a row to `mem0_history` on every Spark.
- [x] Cross-device sync round-trips: phone + laptop with the same Gmail show identical XP / streak / progress.
- [ ] mem0 image is pinned to a SHA (not `:latest`).
- [ ] At least one real email provider is configured and a test welcome email is delivered.
- [ ] Custom domain + TLS is in place for both the SPA and mem0.
- [ ] Postgres `pg_dump` nightly backup is scheduled (7-day retention).
- [x] Per-user mem0 write cap is configured (default 200/day is sensible).

Everything beyond this checklist is **growth + differentiation** (public profiles, Talent Match, mobile, voice) — not blockers to launch.

---

## See also

- [`mvp.md`](./mvp.md) — what's shipped today, in detail.
- [`mem0.md`](./mem0.md) — full mem0 self-hosting guide.
- [`roadmap.md`](./roadmap.md) — the five sprints that close the gaps.
- [`architecture.md`](./architecture.md) — how the boxes fit.
