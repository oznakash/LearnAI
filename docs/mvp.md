# MVP — what works today

> _Honest list of what's shipped and what's not. Updated on every PR._

Live at: **`https://learnai-b94d78.cloud-claude.com`** (cognition layer off by default until you provision mem0).

Source: **`https://github.com/oznakash/learnai`**.

---

## ✅ Shipped (MVP)

### Core game loop

- 12 Topics × 10 Levels × 4–6 Sparks per level = **~480 hand-authored micro-lessons**.
- 8 Spark formats: 📖 MicroRead, 💡 Tip & Trick, 🎯 Quick Pick, 🧩 Fill the Stack, 🔗 Pattern Match, 🧪 Field Scenario, 🛠️ Build Card, 👾 Boss Cell.
- Game mechanics: XP (display name configurable in admin → Branding; default just "XP"), Focus (lives that regen every 18 min), Build Streak (daily), Guild Tiers (Builder → Architect → Visionary → Founder → Singularity), 14 Badges.
- Anti-spam lock: each Spark can only award XP once (regression-tested).

### Onboarding & personalization

- 6-step wizard (~90 seconds): name, age, skill level, interests, daily minutes, goal.
- Age-band shaping (kid / teen / adult).
- Skill-level shaping (5 tiers from "Curious starter" to "Frontier visionary").
- Recalibration flow — 5-question quiz + interest re-pick, retunes the path.

### Identity

- Gmail-only sign-in via Google Identity Services (browser flow, ID-token decoded client-side).
- Demo mode (typed Gmail address) for trials without OAuth setup.
- Hydration race fixed — saved Client ID is honored after refresh.

### Tasks

- Tasks tab — capture YouTube videos, articles, Build Cards. Auto-add from any Spark via the "+ Task" button.
- Statuses (todo / doing / done), filters, counts.
- Build tasks include a 1-tap "Copy prompt" for Claude Code.

### Progress dashboards

- **Per-topic page** — completion ring, levels done, accuracy, time invested, sparks-per-level bars, 14-day activity sparkline, the Path (vertical timeline of all 10 levels).
- **Global dashboard** — XP / Streak / Sparks / Accuracy stat tiles, 14-day sparkline, radar across 8 Topics, Sparks-per-Topic bars, 12-week heatmap, badges grid.

### Cognition layer (opt-in)

- `MemoryService` interface with two implementations: `OfflineMemoryService` (per-user `localStorage`) and `Mem0MemoryService` (HTTP client for self-hosted mem0).
- **Offline-mode kill switch** in admin (default ON). When ON, the SPA runs entirely on the device.
- Event hooks seed memory: onboarding goals, calibration, inferred strengths (3 correct in a row), gaps (2 wrong), level/Boss/badge history.
- **Your Memory** player tab — list / filter / edit / forget / wipe / export.
- TopBar status badge: 📴 / 🧠 / 🟡.

### Admin Console (7 tabs)

- 👥 **Users** — list, search, sort, filter; ban/reset/send-template (mock cohort + the local user).
- 📊 **Analytics** — onboarding funnel, DAU/WAU/MAU, sparks/user, topic popularity, retention table.
- 🧠 **Memory** — master switch, mem0 server config, health-check ping, per-user inspector, daily token cap.
- 📧 **Emails** — provider tiles (Resend / SMTP-relay-webhook / EmailJS / Postmark / SendGrid / SES / none), 8 lifecycle templates with live HTML preview, send-queue + per-message status, "Send test email" form.
- 🎮 **Tuning** — every XP value, focus max + regen, tier thresholds, Boss pass ratio. Live-applied.
- 📚 **Content** — read/edit any topic as JSON, override the seed, reset, export + import (Topic[] or overrides bundle).
- 📝 **Prompt Studio** — assembles the long content-generation prompt with topic / level / count / audience / custom note. With or without an API key — copy + paste-back works either way.
- ⚙️ **Config** — feature flags, branding, defaults, admin allowlist.

### Deployability

- Static SPA at `/dist/`, auto-rebuilt + auto-committed by GitHub Actions on every push to `main`.
- Multi-stage `Dockerfile` (node → nginx-alpine) with tuned `nginx.conf` (gzip, hashed-asset caching, SPA fallback).
- Platform configs: `vercel.json`, `netlify.toml`, `static.json`, root `package.json`.
- Self-hosted mem0 via `docker-compose.mem0.yml` + `.env.example`.
- One-command Fly deploy: `OPENAI_API_KEY=... npm run deploy:mem0` + `npm run smoke:memory`.

### Social layer (Sprint 2 — shipped behind feature flags)

- **Public Profile** at `/u/<handle>` — behavioral résumé: Topic map, Signals, currently-working-on, 14-day activity, badges. No bio, no employer, no email displayed. Closed-mode profiles render a single gated card to non-followers.
- **Settings → Network** — Profile mode toggle (Open / Closed), field-level visibility (full name, current Topic, Topic map, activity, badges, sign-up month, Global Leaderboard), Signals picker (max 5 Topics), Take-me-down panic switch.
- **Follow / Unfollow / Mute / Block / Report** — every Profile (and inline on Stream cards). Asymmetric graph; report auto-mutes; block precedence removes existing edges. 5-reason picker on reports, 280-char note.
- **Topic Leaderboards (Boards)** — replaces the single Guild leaderboard with tabbed Global / per-Topic / Following + Week/Month/All-time pills. Per-Topic tabs only appear for the player's active Signals (max 5); `+ Topic` button opens an ad-hoc picker for any of the 12 Topics. Mock filler ("sample" tag) below real rows when sparse.
- **Spark Stream** — auto-derived feed (level-up / boss-beaten / streak-milestone / spotlight cards). Per-card actions: Follow, Try this Topic, Mute author. "All / Only people I follow" filter. **No engagement-feedback term in ranking** (vision §4).
- **Admin → Moderation tab** — report queue (Open / Resolved). Resolution actions: ✓ No action / ⚠ Warn / 🚫 Ban from social / 🚷 Global ban. Optimistic removal + audit on resolve.
- **`services/social-svc/`** — Node + Express + TypeScript backend. 19 REST endpoints, in-memory store with optional JSON-file persistence, viewer-aware projection. Production migration to Postgres-2 documented in the README.
- **`services/auth-proxy/`** — Cloudflare Worker that fronts both mem0 + social-svc. Verifies Google ID token, injects `X-User-Email`, rate-limits per email, swaps in upstream API keys (kept out of the browser). **Closes the bearer-in-browser issue.**
- **All flags default OFF** in `defaults.ts` so a fork pulling main today sees zero behavior change. Live deploy flips them on via admin localStorage.

→ Sprint changelog + open punch list: [`social-mvp-status.md`](./social-mvp-status.md).

### Quality bar

- **287 tests passing**: 256 SPA (Vitest) + 21 social-svc (supertest+vitest) + 10 auth-proxy (vitest).
- Build: ~556 KB JS / ~30 KB CSS gzipped, ~83 modules.
- Pinch-zoom + double-tap-zoom blocked (mobile + desktop trackpad). Keyboard zoom intentionally preserved.
- Overscroll bounce stopped.
- Confetti, mascot moods, illustrations, animated transitions.

### Documentation library (`docs/`)

- Strategy: [`vision.md`](./vision.md) · [`problem.md`](./problem.md) · [`use-cases.md`](./use-cases.md) · [`competitors.md`](./competitors.md) · [`pitch-deck.md`](./pitch-deck.md) · [`manifesto.md`](./manifesto.md).
- Technical: [`architecture.md`](./architecture.md) · [`technical.md`](./technical.md) · [`mem0.md`](./mem0.md) · [`ux.md`](./ux.md) · [`design-language.md`](./design-language.md).
- Social MVP: [`social-mvp-product.md`](./social-mvp-product.md) (PRD) · [`social-mvp-engineering.md`](./social-mvp-engineering.md) (eng plan) · [`social-mvp-status.md`](./social-mvp-status.md) (changelog).
- Sprint planning: [`mvp.md`](./mvp.md) (this) · [`roadmap.md`](./roadmap.md).
- Community: [`contributing.md`](./contributing.md) · [`fork-recipe.md`](./fork-recipe.md).
- Service READMEs: [`../services/social-svc/README.md`](../services/social-svc/README.md) · [`../services/auth-proxy/README.md`](../services/auth-proxy/README.md).

---

## 🟡 Half-shipped / known-limited

- **Leaderboard** — local + bot Guild members. Real cohort sync requires the auth-verifying proxy + a public-profile schema (Sprint 2).
- **Analytics** — overlay the local user's real history on a deterministic mock cohort. Real cross-user analytics need a backend.
- **Email send** — the queue actually sends through Resend / SMTP-relay-webhook / EmailJS. Postmark / SendGrid / SES require a server-side relay (intentional).

---

## ⚠️ Not yet shipped

| Capability | Why we don't have it yet | When |
|---|---|---|
| Production hardening of the social layer (Postgres-2 swap, snapshot pipeline wiring, server-side upstream-bearer enforcement) | The Sprint-2 PRs shipped the surface; Sprint 2.5 closes the open P0/P1 punch list before flipping flags on in production. See [`social-mvp-status.md`](./social-mvp-status.md). | Sprint 2.5 |
| Contribution flow (community-authored Sparks with AI-assisted review) | Needs review pipeline + maintainer queue | Sprint 3 |
| Talent Match (recruiters search the behavioral graph) | Needs public profiles (✅ Sprint 2) + skills index | Sprint 4 |
| Audio / voice mode (listen + answer) | Demand-gated — no users have asked yet | Sprint 5 |
| Native mobile shell | Web works great on mobile; revisit when retention proves it | Sprint 5–6 |
| Multi-admin sync (admin config in mem0 system-scope) | One admin per deploy is enough today | Sprint 3 |
| Stripe / billing | No revenue feature gated yet | Whenever we decide to monetize |

---

## How to verify any claim above

```sh
# Source on disk, not screenshots:
npm test                              # SPA: 256 / 256
npm test --prefix services/social-svc # 21 / 21
npm test --prefix services/auth-proxy # 10 / 10
npm run build                         # green
npm run dev                           # play it
```

---

## See also

- [`roadmap.md`](./roadmap.md) — what ships next.
- [`vision.md`](./vision.md) — why each next item matters.
- [`architecture.md`](./architecture.md) — how each new capability fits.
