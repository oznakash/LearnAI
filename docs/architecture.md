# Architecture

> _A static SPA in front, an opt-in cognition layer behind, and a community-curated curriculum in source code. Designed to fit in a single Markdown page._

For the deeper service-by-service breakdown, see [`technical.md`](./technical.md). For the cognition-layer specifics, see [`mem0.md`](./mem0.md).

---

## High-level diagram

```
                   ┌──────────────────────────────────────────┐
                   │  ╔════════════════════════════════════╗  │
                   │  ║   BuilderQuest SPA (React + Vite)   ║  │
                   │  ║                                      ║  │
                   │  ║   • Game loop (Sparks, Boss, XP)     ║  │
                   │  ║   • Onboarding · Recalibration       ║  │
                   │  ║   • Memory tab · Tasks · Dashboard   ║  │
                   │  ║   • Admin Console (7 tabs)           ║  │
                   │  ╚════════════════════════════════════╝  │
                   │                  ▲    ▲                  │
                   │                  │    │                  │
                   │   localStorage   │    │   GIS (browser)  │
                   │   (offline       │    │   Google Sign-In │
                   │   profile +      │    │                  │
                   │   progress)      │    │                  │
                   └──────────────────┼────┼──────────────────┘
                                      │    │
                  HTTP (browser)      │    │   ID token (Gmail-only)
                                      ▼    ▼
       ┌──────────────────────────────────────────────────────┐
       │  Cognition layer — self-hosted mem0 (optional)        │
       │                                                        │
       │   ┌─────────────────────┐    ┌────────────────────┐    │
       │   │ mem0 server (HTTP)  │◀───│ Postgres + pgvector│    │
       │   │ • extract           │    │ • memories table   │    │
       │   │ • search            │    │ • vector index     │    │
       │   │ • store             │    └────────────────────┘    │
       │   │ • forget            │                               │
       │   └──────────┬──────────┘                               │
       │              │                                          │
       │              ▼ fact extraction                          │
       │     OpenAI / Anthropic API                              │
       │     (admin's key, not the user's)                       │
       └──────────────────────────────────────────────────────┘
```

That's it. Two boxes, one optional. **The whole product runs without the cognition layer** (offline mode is the default).

---

## Box-by-box

### 1. The SPA (React + Vite)

- **Where it runs:** any static host. Today: cloud-claude.com. Could be Cloudflare Pages, Vercel, Netlify, S3+CloudFront, your own nginx.
- **What it builds to:** `/dist/` at the repo root. Auto-rebuilt + auto-committed on every push to `main` by `.github/workflows/build-and-publish-dist.yml`. Static-mirror hosts get a working SPA immediately.
- **State:** all client-side. `localStorage` for player state (`builderquest:v1`) and admin state (`builderquest:admin:v1`). Plus per-user offline-memory namespace when the cognition layer is off.
- **Identity:** Google Identity Services in the browser. ID token decoded client-side; only Gmail addresses accepted. (Server-side verification is added when we ship Talent Match.)
- **Tech:** React 19, TypeScript, Tailwind 3, Vitest. ~75 modules, ~478 KB JS / ~29 KB CSS gzipped. No backend dependency at the SPA tier.

### 2. The cognition layer (self-hosted mem0)

- **Where it runs:** Fly.io (recommended), Render, Railway, or your own VPS via the included `docker-compose.mem0.yml`.
- **Image:** `ghcr.io/oznakash/mem0:latest` (a fork of mem0/mem0 you control + republish via the workflow at `docs/mem0-fork-publish.workflow.yml`).
- **Storage:** Postgres 16 + pgvector. Single data store. No Redis.
- **Tenancy:** by Gmail. Every API call carries `user_id = <user's Gmail>`.
- **Auth:** bearer token (currently in the browser; with Talent Match we add a tiny auth-verifying proxy in front).
- **Provider for fact extraction:** OpenAI by default (cheap + fast for this task), Anthropic via env flip.

### 3. The seed curriculum

- **Where it lives:** TypeScript in `app/src/content/topics/*.ts`. 12 Constellations × 10 Levels × 4–6 Sparks each, hand-authored.
- **Why TypeScript and not a CMS:** version control, code review, rich-typed exercises, zero infra. Forks copy the same shape.
- **Admin overrides:** `AdminConfig.contentOverrides` lets an admin replace any topic by id at runtime. Lives in admin localStorage (single-admin) or, in production, in mem0 as system-scoped memories.

### 4. The admin console

- 7 tabs: Users · Analytics · Memory · Emails · Tuning · Content · Prompt Studio · Config.
- Gated by a Gmail allowlist (the first signed-in admin bootstraps).
- All edits live in `localStorage`. Every variable affecting the runtime can be overridden — XP table, focus regen, tier thresholds, Boss pass ratio, content, branding, feature flags.
- Email lifecycle pipeline: 8 templates, live HTML preview, Resend / SMTP-relay-webhook / EmailJS providers, queue + per-message status.

---

## How the layers talk

```
   ┌──────────────────────────────────────────────────────────────┐
   │ Player completes a Spark                                       │
   └──────────┬───────────────────────────────────────────────────┘
              │
              ▼
   ┌──────────────────────┐
   │ PlayerContext         │  ── XP, Focus, Streak, badges (localStorage)
   └──────────┬────────────┘
              │
              ▼ fire-and-forget
   ┌──────────────────────────┐
   │ MemoryProvider           │  ── selectMemoryService()
   │   .remember()            │     · offline → localStorage
   │                          │     · online  → mem0 HTTP
   └──────────────────────────┘
              │
              ▼  HTTP only when online
   ┌──────────────────────────┐
   │ ghcr.io/oznakash/mem0    │  ── extract → store → search
   └──────────────────────────┘
```

The critical UX path (next Spark, next screen) **never blocks** on a memory call. Memory writes are fire-and-forget and wrapped in `withMemoryGuard()` so failures degrade silently.

---

## Failure-mode topology

| What breaks | What the user sees | Recovery |
|---|---|---|
| `cloud-claude.com` static host down | Whole app down | Cloudflare/Vercel/Netlify failover (any of the configs in repo) |
| mem0 server unreachable | TopBar badge flips 🟡, memory writes pause | Auto-retry; offline fallback maintains heuristic experience |
| LLM provider down | mem0 cannot extract; admin sees the failure in logs | mem0 stores raw text, retries; or admin flips to other provider |
| Postgres down | mem0 returns 5xx; same as "mem0 unreachable" | DB restart; mem0 retries |
| GitHub Actions broken | Live `/dist/` may go stale | `npm run build` locally, push the artifact |
| Google Identity outage | New sign-ins blocked | Demo mode (Gmail address typed in) keeps demos alive |

---

## Data classification

| Class | Examples | Where it lives | Why |
|---|---|---|---|
| **Public-static** | Seed curriculum, illustrations | TypeScript in `app/src/content/`, illustrations as SVG | Compounds with PRs, version-controlled |
| **Admin-static** | Branding, flags, email templates, tuning | `localStorage` (admin browser) | Single-admin v1; migrates to mem0 system-scope when multi-admin |
| **Player-private** | Profile, XP, history, tasks | `localStorage` (per device) + (optional) mem0 | Per-device today; cross-device when we add server-side state in Sprint 2 |
| **Cognitive** | Memories | mem0 (online) or `localStorage` (offline) | The whole point |
| **Secrets** | API keys (OpenAI, Anthropic, Google OAuth, SMTP) | Browser `localStorage` (player keys) or Fly secrets (server) | Keep server-side what should be server-side |

**What we never store**: raw user-typed chat content (we summarize first), API keys in mem0, PII beyond email + first-name, location/IP/device fingerprint.

---

## Why this architecture

Three forces shaped it:

1. **Default to no infra.** Most early users will see BuilderQuest as a SPA. We let them.
2. **Make the cognition layer additive, not foundational.** Adding intelligence shouldn't require a server-side rewrite.
3. **Decouple every layer.** SPA build, image build, deploy, content edits — all separately versionable and deployable.

The architecture is intentionally small. **A senior engineer can read it in 15 minutes and ship a feature in an hour.** That's the target.

---

## What changes when we ship the social + Talent Match (Sprint 2)

```
   Browser ── ID token ──► tiny auth-proxy ──► mem0
                                  │
                                  └──► Postgres (separate DB):
                                       · public_profiles
                                       · follows
                                       · contributions
                                       · talent_search_index
```

The proxy is a Cloudflare Worker (~50 lines) that verifies the Google ID token, injects `user_id` server-side, rate-limits per Gmail, and forwards. Both the bearer-in-browser problem and the multi-tenant audit story go away.

The social/talent-graph data goes in a separate Postgres database alongside mem0. We deliberately keep memories (cognitive, private) in their own DB and identity/social (public, queryable) in another. Less blast radius, cleaner GDPR story.

---

## See also

- [`technical.md`](./technical.md) — the engineer-implementation view (services, types, hooks).
- [`mem0.md`](./mem0.md) — the cognition layer in depth.
- [`ux.md`](./ux.md) — how the player experiences this architecture.
- [`mvp.md`](./mvp.md) — what's actually deployed today vs. planned.
