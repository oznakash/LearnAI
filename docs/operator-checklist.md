# LearnAI — Operator Checklist

> _Everything an operator needs to take LearnAI from "great demo" to "real product." Setup steps, current capabilities, gaps, risks, and a hard definition of "production-ready."_

The full SPA is **shipped, tested (100/100), and deployable today**. To turn the public demo into a real product, two external integrations need to be provisioned: **Google OAuth** (so users sign in as themselves, not in demo mode) and **self-hosted mem0** (so memory persists across devices and the cognition layer turns on). Everything else is either already live or sits behind the post-MVP roadmap.

---

## 🛠 What needs to be done to make it work

| # | Step | Who does it | Time | Cost |
|---|---|---|---|---|
| 1 | **Provision Google OAuth Client ID.** Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client (Web). Authorized origins: prod URL + `http://localhost:5173`. No client secret needed (browser flow). | Owner | ~10 min | Free |
| 2 | **Paste Client ID** into the in-app sign-in screen (or Settings tab). It's stored in `localStorage` — no rebuild. | Owner / each admin | ~30 sec | — |
| 3 | **Deploy mem0** via the one-command Fly script: `OPENAI_API_KEY=sk-… npm run deploy:mem0`. Idempotent. Provisions the app, attaches managed Postgres + pgvector, generates a bearer key, prints the URL. | Owner (CLI) | ~5 min | ~$5/mo idle on Fly free tier; ~$0.20/user/year in OpenAI extraction |
| 4 | **Smoke test** the deploy: `npm run smoke:memory -- https://learnai-mem0.fly.dev <bearerKey>`. Health → add → list → search → wipe. Exits non-zero on any failure. | Owner | ~30 sec | — |
| 5 | **Wire mem0 into the SPA.** Admin Console → Memory tab → paste server URL + bearer key → Health check → flip **Offline Mode OFF**. | Admin | ~1 min | — |
| 6 | **Pin a SHA tag** for prod (replace `:latest` with `ghcr.io/oznakash/mem0:sha-…`). Prevents silent upstream changes. | Owner | ~1 min | — |
| 7 | (Optional) **Configure email provider** in Admin → Emails. Resend / SMTP-relay-webhook / EmailJS work browser-side; Postmark/SendGrid/SES need a server-side relay. | Admin | ~5 min | Provider-dependent |
| 8 | (Optional) **Custom domain + DNS + TLS** for both the SPA and mem0. Required if you want `learnai.com` instead of `learnai-b94d78.cloud-claude.com`. | Owner | ~30 min | Domain registrar |

After step 5, the product is "real": users sign in with their Gmail, memories persist across devices, the cognition layer is live, and the offline-mode kill switch is your safety net.

---

## ✅ Capabilities shipped today

| Capability | What it does | Status |
|---|---|---|
| **Curriculum** | 12 Constellations × 10 levels × 4–6 Sparks ≈ **480 hand-authored micro-lessons**. 8 Spark formats (MicroRead, Tip, Quick Pick, Pattern Match, Fill the Stack, Field Scenario, Build Card, Boss Cell). | ✅ |
| **Onboarding** | 6-step ~90-sec wizard. Age band + skill level + interests + minutes + goal. Recalibration flow (5-Q quiz). | ✅ |
| **Game loop** | XP, Focus (lives, regen 18m), Build Streak, 5 Guild tiers, 14 Badges, anti-spam XP lock. Mascot name + XP unit display name configurable in Admin → Branding. | ✅ |
| **Identity** | Gmail-only sign-in via Google Identity Services (browser flow). Demo mode for trials without OAuth. | ✅ (needs Client ID) |
| **Cognition layer** | `MemoryService` interface, `OfflineMemoryService` (localStorage) + `Mem0MemoryService` (HTTP). Event hooks for goals, calibration, strengths, gaps, history. | ✅ (needs mem0 server) |
| **"Your Memory" tab** | List / filter / edit / forget / wipe / export. Read-write parity. | ✅ |
| **Tasks tab** | YouTube/article/Build-Card capture; statuses, filters, 1-tap "Copy prompt" for Claude Code. | ✅ |
| **Dashboards** | Per-topic ring/bars/sparkline + global radar/heatmap/badges grid + 12-week heatmap. | ✅ |
| **Admin Console** | 7 tabs: Users · Analytics · Memory · Emails · Tuning · Content · Prompt Studio · Config. Tuning is live-applied. | ✅ |
| **Email lifecycle** | 8 templates with HTML preview. Real send via Resend / SMTP-relay / EmailJS. | ✅ (others need relay) |
| **Deployability** | Static SPA, auto-rebuilt + auto-committed on every push to `main`. Dockerfile, nginx.conf, vercel.json, netlify.toml, static.json. One-command Fly deploy for mem0. | ✅ |
| **Quality bar** | 100/100 Vitest tests across 13 files. 478 KB JS / 29 KB CSS gzipped. | ✅ |

---

## ⚠️ Gaps (not shipped) — what's missing for the full vision

| Gap | Why it matters | Why we don't have it | When |
|---|---|---|---|
| **Auth-verifying proxy in front of mem0** | Today the bearer key sits in the admin's browser. Multi-tenant safety needs a proxy that verifies Google ID tokens, injects `user_id`, and rate-limits per Gmail. | Required before going truly multi-tenant. ~50-line Cloudflare Worker. | Sprint 2 |
| **Public profile pages** | The "profile is a living record" promise needs a `/profile/<handle>` shareable URL. | Needs backend storage for shared profile data alongside mem0. | Sprint 2 |
| **Real cohort leaderboard** | Today's leaderboard is local + bot Guild members. | Same — needs the auth-verifying proxy + public profile schema. | Sprint 2 |
| **Real cross-user analytics** | Admin Analytics today overlays the local user on a deterministic mock cohort. | Needs a backend. | Sprint 2 |
| **Community-contributed Sparks** | The "creators distill the AI internet into Sparks" loop is the core social-network thesis. Today, only admins/maintainers can author. | Needs an AI-assisted review pipeline + maintainer queue + attribution UX. | Sprint 3 |
| **Talent Match** | The "new LinkedIn for AI" outcome — companies search the behavioral graph for "shipped X with Y in last 90 days." | Needs public profiles + skills index + recruiter view. | Sprint 4 |
| **Verified Build Card completions** | Recruiters need anti-fake signal — signed artifacts (URL → SHA → claim). | Builds on the talent layer. | Sprint 4 |
| **Native mobile shell** | Phone-first habit. PWA → Capacitor → React Native depending on traction. | Web works great on mobile today; gated on retention proof. | Sprint 5 |
| **Voice mode** | Listen + answer for accessibility / commute. | Demand-gated. | Sprint 5 |
| **On-device cognition** | Differentiator vs. any cloud-only competitor; option to run mem0 fully on-device for privacy-strict users. | Smaller models maturing. | Sprint 5 |
| **Stripe / billing** | Pro tier, recruiter platform fees, Org seats. | No revenue feature gated yet. | Whenever monetization starts |
| **Multi-admin sync** | Admin config in mem0 system-scope so several admins see the same settings. | One admin per deploy is enough today. | Sprint 3 |
| **Localization** | TAM expansion. UI internationalization + Spark localization via Prompt Studio. | Sequenced after mobile. | Sprint 5 |

---

## 🔒 Risk register (the things that can break)

| Risk | Severity | Mitigation already in place |
|---|---|---|
| mem0 server down | Medium | Pause-mode badge in TopBar + heuristic fallback in Home/Play. The game still works without memory. |
| Bearer key leakage (browser-side today) | Medium | Sprint-2 auth-verifying proxy; until then, treat the deploy as single-tenant. |
| LLM cost runaway | Low | Per-user daily write cap (default 200/day) configurable in Admin → Memory. |
| Memory drift / wrong facts | Low | "Forget" + "Wipe all" surfaced on every memory. Read-write parity is the privacy ethic. |
| `:latest` mem0 image surprise | Low | Pin to SHA tag in `MEM0_IMAGE`/Fly secrets for prod. |

---

## 🎯 Definition of "production-ready"

You can call it shipped to real users when **all** of the following are true:

- [ ] Google OAuth Client ID is set and a test Gmail user can sign in (no demo mode).
- [ ] mem0 is deployed, smoke test passes, Offline Mode is OFF in Admin.
- [ ] mem0 image is pinned to a SHA (not `:latest`).
- [ ] At least one real email provider is configured and a test welcome email is delivered.
- [ ] Custom domain + TLS is in place for both the SPA and mem0.
- [ ] Postgres `pg_dump` nightly backup is scheduled (7-day retention).
- [ ] Per-user mem0 write cap is configured (default 200/day is sensible).

Everything beyond this checklist is **growth + differentiation** (public profiles, Talent Match, mobile, voice) — not blockers to launch.

---

## See also

- [`mvp.md`](./mvp.md) — what's shipped today, in detail.
- [`mem0.md`](./mem0.md) — full mem0 self-hosting guide.
- [`roadmap.md`](./roadmap.md) — the five sprints that close the gaps.
- [`architecture.md`](./architecture.md) — how the boxes fit.
