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
- **Adaptive recalibration** — 5-question quiz with smart probes (anchor at the player's level + one and two levels up + one level down + one cross-area probe), drawn from a tagged pool that excludes ids the player has already seen. Records `profile.calibratedLevel` (1-10) — when the player opens a *fresh* topic, recommendations start at that level instead of always at L1. Plus the existing interest re-pick.

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
- **`services/social-svc/`** — Node + Express + TypeScript social-graph backend. 19 REST endpoints, in-memory store with optional JSON-file persistence, viewer-aware projection. **Bundled inside the SPA container as a sidecar** (single deploy unit on cloud-claude); nginx reverse-proxies `/v1/social/*` to `localhost:8787`. Auth: verifies the mem0-issued session JWT locally with the shared `JWT_SECRET` — no separate proxy, no Cloudflare account, no bearer-in-browser issue. Production migration to Postgres-2 is one module swap (documented in the service README).
- **All flags default OFF** in `defaults.ts` so a fork pulling main today sees zero behavior change. Live deploy flips them on via admin localStorage.

→ Sprint changelog + open punch list: [`social-mvp-status.md`](./social-mvp-status.md).

### Content engine — Sprint #2 foundation (shipped)

- **Spark categories + freshness chip** — Six categories (`principle` / `pattern` / `tooling` / `company` / `news` / `frontier`) with per-category shelf life. Sparks that set `addedAt` + `category` render an age chip ("3 d ago" / "stale soon" / "outdated"). Doctrine: [`content-freshness.md`](./content-freshness.md).
- **Age-band tone** — MicroRead and Tip Sparks may carry `bodyByAgeBand: { kid?, teen?, adult? }`. The renderer picks the right body for the user's profile band, falls back to default `body` otherwise. First seeded on the "AI is pattern, not magic" Spark in **AI Foundations**.
- **YouTube nugget Spark** — Second source-anchored variant after PodcastNugget. Renders with channel name, video title, duration, "watch on YouTube" CTA. Pilot constraint: ≥ 5 min, ≤ 60 d old, 10 max in seed.
- **External-source creators registry** — 8 new creators (AlphaSignal, Hacker News / YC, Anthropic news, Simon Willison, Hugging Face, Latent Space, DeepMind, Y Combinator). Sparks reference creator id; renderer surfaces avatar + "via X" without inlining attribution.
- **Critique chips → meta-implicit refinement** — A 👎 vote opens 7 chips (too-theoretical · wrong-examples · outdated · too-jargon · watered-down · wrong-level · too-long). Each tap writes a `critique`-category memory whose aggregation (`app/src/store/critique.ts`) folds into a prompt-bias stanza. Designed to shape generation at small N, where per-Spark vote stats are still noisy.

### Quality bar

- **310 tests passing**: 266 SPA (Vitest) + 44 social-svc (supertest+vitest). Sprint 2.5 PR 12 added the close-out polish: `/health` startup state, Stream Signal-overlap + spotlight cron, telemetry endpoint, and admin telemetry panel.
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
- Service README: [`../services/social-svc/README.md`](../services/social-svc/README.md).
- Operator runbook: [`operator-checklist.md`](./operator-checklist.md) — env vars, deploy steps, monitoring, log keys to alert on.

---

## 🟡 Half-shipped / known-limited

- **Leaderboard** — local + bot Guild members. Real cohort sync requires the auth-verifying proxy + a public-profile schema (Sprint 2).
- **Analytics** — overlay the local user's real history on a deterministic mock cohort. Real cross-user analytics need a backend.
- **Email send** — the queue actually sends through Resend / SMTP-relay-webhook / EmailJS. Postmark / SendGrid / SES require a server-side relay (intentional).

---

## ⚠️ Not yet shipped

| Capability | Why we don't have it yet | When |
|---|---|---|
| `PodcastNugget` Spark variant + first ~12 nuggets from [Lenny's Podcast](https://www.lennysnewsletter.com/podcast) (Boris Cherny, Simon Willison, Benjamin Mann, April Dunford, …), gated by `flags.lennyContentEnabled` (default ON) | Reference doc and seed nuggets are staged in [`lenny-archive.md`](./lenny-archive.md). Engine work + topic-file integration land in the active content-experience sprint. See [`content-experience-plan.md`](./content-experience-plan.md). | Active sprint (PR (b)) |
| 👍 / 👎 feedback on every Spark + permanent skip on 👎 (per-user) + admin roll-up of best/worst Sparks | Schema and UX outlined in [`content-experience-plan.md`](./content-experience-plan.md). Cognition-layer hook writes a `preference` memory on 👎 so mem0 stops surfacing similar shapes. | Active sprint (PR (c)) |
| mem0-driven session sequencer + visual-box redesign (concept-tied diagrams, mobile-first sizing) | Today the mem0 layer observes but doesn't drive sequencing; the animation slot shows the same generic illustration regardless of concept. See [`content-experience-plan.md`](./content-experience-plan.md). | Active sprint (PR (a)) |
| **Three-choice row on every Spark** — *✅ Got it · 🔍 Zoom in · ⏭ Skip-not-now* alongside the existing 👍/👎. The Zoom-in path spawns a child Spark that links back to the parent. The Skip-not-now path is distinct from 👎 (which is permanent). Roadmap defined in [`content-model.md`](./content-model.md) §8 #1 | The user's three responses to any Spark are first-class in the model but only ✅ ships today. Zoom-in / Skip are the highest-leverage gaps for *Memory acceptance ≥ 45%* and *"felt made for me" ≥ 80%*. | Active content sprint |
| **`intent` memory at onboarding + intent-aware Level-Cleared CTA** — multi-select *Curious / Applied / Decision / Researcher / Forker* on the wizard last step, stored as a `goal`-category memory; the secondary CTA on the Level-Cleared screen picks per-mode (Build Card for *Applied*, Go Deeper for *Curious*, etc.). [`content-model.md`](./content-model.md) §8 #2–3 | Today the daily-quest topic shifts after a clear, but the secondary nudge is universal ("Try a different topic") — a hard miss for the WAB conversion moment | Active content sprint |
| **`vocabulary` memory category + inline term tap-to-define** — every Spark declares the vocab atoms it uses; on completion the user's vocab is updated; new Sparks check before assuming. Atoms render as subtle underlines; tap → mini popover → optional zoom-in Spark. [`content-model.md`](./content-model.md) §2.4, §8 #4–5 | Just-in-time vocabulary is the third pillar of the content model and has zero implementation today | Next content sprint |
| **Source-anchored Spark variants beyond `PodcastNugget`** — `VideoNugget`, `PaperNugget`, `ReleaseNote`, `EssayNugget`, `NewsletterNugget`. Each inherits the `PodcastNugget` shape from [`lenny-archive.md`](./lenny-archive.md) and is rendered through the same source-anchor template | The thesis in [`content-model.md`](./content-model.md) §2.2 — *any source can become a Spark* — currently has one (1) implementation. Scaling source variety is the natural next move | Next content sprint |
| **AI-assisted compression pipeline (the "engine")** — daily cron picks one source per Topic, drafts 3 candidate Sparks via the existing PromptStudio shape, queues for human approval. [`content-model.md`](./content-model.md) §3 step 2 + §8 #7 | Steps 3, 4, 5 of the compression pipeline are pure software (already running). Step 2 — the actual compression — is fully manual. Scaling step 2 with model-assist is the unlock for 5× content velocity | Sprint 3 |
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
npm test                              # SPA: 266 / 266
npm test --prefix services/social-svc # 44 / 44
npm run build                         # green
npm run dev                           # play it
```

---

## See also

- [`roadmap.md`](./roadmap.md) — what ships next.
- [`vision.md`](./vision.md) — why each next item matters.
- [`architecture.md`](./architecture.md) — how each new capability fits.
