# MVP — what works today

> _Honest list of what's shipped and what's not. Updated on every PR._

Live at: **`https://learnai-b94d78.cloud-claude.com`** (cognition layer off by default until you provision mem0).

Source: **`https://github.com/oznakash/learnai`**.

---

## ✅ Shipped (MVP)

### Core game loop

- 12 Constellations × 10 Levels × 4–6 Sparks per level = **~480 hand-authored micro-lessons**.
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
- **Global dashboard** — XP / Streak / Sparks / Accuracy stat tiles, 14-day sparkline, radar across 8 Constellations, Sparks-per-Constellation bars, 12-week heatmap, badges grid.

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

### Quality bar

- **90 / 90** Vitest tests across 12 files.
- Build: 478 KB JS / 29 KB CSS gzipped, 75 modules.
- Pinch-zoom + double-tap-zoom blocked (mobile + desktop trackpad). Keyboard zoom intentionally preserved.
- Overscroll bounce stopped.
- Confetti, mascot moods, illustrations, animated transitions.

### Documentation library (`docs/`)

- [`vision.md`](./vision.md) · [`problem.md`](./problem.md) · [`use-cases.md`](./use-cases.md) · [`competitors.md`](./competitors.md) · [`pitch-deck.md`](./pitch-deck.md) · [`architecture.md`](./architecture.md) · [`mvp.md`](./mvp.md) (this) · [`roadmap.md`](./roadmap.md) · [`contributing.md`](./contributing.md) · [`fork-recipe.md`](./fork-recipe.md) · [`ux.md`](./ux.md) · [`technical.md`](./technical.md) · [`mem0.md`](./mem0.md).

---

## 🟡 Half-shipped / known-limited

- **Leaderboard** — local + bot Guild members. Real cohort sync requires the auth-verifying proxy + a public-profile schema (Sprint 2).
- **Analytics** — overlay the local user's real history on a deterministic mock cohort. Real cross-user analytics need a backend.
- **Email send** — the queue actually sends through Resend / SMTP-relay-webhook / EmailJS. Postmark / SendGrid / SES require a server-side relay (intentional).

---

## ⚠️ Not yet shipped

| Capability | Why we don't have it yet | When |
|---|---|---|
| Public builder profile pages | Needs backend storage for shared profile data | Sprint 2 |
| Follow graph (followers, feed of who's learning what) | Same | Sprint 2 |
| Contribution flow (community-authored Sparks with AI-assisted review) | Needs review pipeline + maintainer queue | Sprint 3 |
| Talent Match (recruiters search the behavioral graph) | Needs public profiles + skills index | Sprint 3 |
| Audio / voice mode (listen + answer) | Demand-gated — no users have asked yet | Sprint 4 |
| Native mobile shell | Web works great on mobile; revisit when retention proves it | Sprint 4–5 |
| Auth-verifying proxy in front of mem0 | Required before going truly multi-tenant | Sprint 2 |
| Multi-admin sync (admin config in mem0 system-scope) | One admin per deploy is enough today | Sprint 3 |
| Stripe / billing | No revenue feature gated yet | Whenever we decide to monetize |

---

## How to verify any claim above

```sh
# Source on disk, not screenshots:
npm test           # 90 / 90
npm run build      # green
npm run dev        # play it
```

---

## See also

- [`roadmap.md`](./roadmap.md) — what ships next.
- [`vision.md`](./vision.md) — why each next item matters.
- [`architecture.md`](./architecture.md) — how each new capability fits.
