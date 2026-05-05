# LearnAI — Documentation

> _The wiki. Strategy, technical, operator. Everything's a Markdown file. Nothing's hidden in a Notion._

---

## Strategy & narrative

| Document | What's in it | When you'd read it |
|---|---|---|
| [`manifesto.md`](./manifesto.md) | Who we are · mission · vision · 8 values for users worldwide · 11 operating principles · what we won't do | Anyone asking "what is LearnAI, in one read?" Pitch prep, hiring, contributor onboarding. |
| [`vision.md`](./vision.md) | Mission · vision · end game · five-year arc · what we will not do | The longer-form companion to the manifesto, with the strategic-pillars + 5-year arc. |
| [`problem.md`](./problem.md) | The four-axis trap · who feels it · why existing options fail · our hypothesis | Convincing a skeptic. Recruiting. Investor first call. |
| [`use-cases.md`](./use-cases.md) | Seven personas walking through real journeys (PM, kid, retiree, researcher, hiring manager, educator-fork-er) | Designing a feature. Writing a Spark. Empathy check. |
| [`competitors.md`](./competitors.md) | Quadrant chart · why no one's done it · what gives us defensibility · what we should be paranoid about | Strategy reviews. Investor deep-dive. |
| [`pitch-deck.md`](./pitch-deck.md) | 12 text-only slides — the partner / investor pitch | Strategic conversations. |
| [`roadmap.md`](./roadmap.md) | 7 sprints in detail · Sprint 2 ✅ shipped · Sprint 2.5 closes the social punch list · what we will *not* do | Planning the next PR. |
| [`mvp.md`](./mvp.md) | What's shipped today · what's half-shipped · what's not yet shipped (auditable) | Anyone asking "does it actually work?" |
| [`metrics.md`](./metrics.md) | North Star (Weekly Active Builders) · supporting KPIs across acquisition, onboarding, engagement, content, network, cognition, talent, forks · guardrails · competitor watch | Reviewing a launch. Tuning a feature. Calling out when WAB is lying to us. |
| [`social-mvp-product.md`](./social-mvp-product.md) | Sprint-2 social MVP from a product-exec lens · Follow / Spark Stream / Topic Leaderboards / Signals · privacy posture · UI surface map · success metrics | Reviewing or building the social network layer. |
| [`social-mvp-engineering.md`](./social-mvp-engineering.md) | Sister doc to the social PRD · Postgres-2 schema · `SocialService` contract · auth-verifying proxy · tests · rollout · risk register | Implementing the social MVP in a single PR. |
| [`social-mvp-status.md`](./social-mvp-status.md) | Sprint-2 changelog (9 PRs) · open P0/P1 punch list from the post-merge review · what Sprint 2.5 closes | Anyone shipping Sprint 2.5 or asking "is the social layer production-ready?" |
| [`profile-enhancements.md`](./profile-enhancements.md) | Three additive lifts on top of the public-profile MVP — Public/Private terminology, profile completeness gauge, native-share, per-profile SEO + JSON-LD | Touching `Profile.tsx`, `Network.tsx`, `Settings.tsx`, or anything in `app/src/profile/`. |
| [`profile.md`](./profile.md) | **The senior-PM contract for profiles.** Five jobs · users' mental model · interests-+-signals merge into Topics · identity consistency rules · five growth levers · UX checklist · anti-patterns · implementation map | Read **first** before touching `Network.tsx`, `Settings.tsx`, the TopBar avatar, or any naming / discoverability surface. |
| [`profile-linkedin.md`](./profile-linkedin.md) | **The senior-PM contract for LinkedIn Connect.** Two-bucket data model (visible + editable; context + hidden) · OIDC scopes · what we don't ask for · phased rollout (v0 intent → v1 OIDC → v2 verified-human → v3 share) · privacy posture · operator setup checklist · the honest read on LinkedIn's API in 2026 | Touching anything LinkedIn-shaped: the CTA in `Network.tsx`, the routes in `services/social-svc`, the `LinkedinIdentity` shape. |
| [`legal/privacy.md`](./legal/privacy.md) · [`legal/terms.md`](./legal/terms.md) | **The Privacy Policy + Terms of Use rendered at `/privacy` and `/terms`.** Plain-English, three-questions structure, open-source / self-host honesty plays. Source-of-truth for both the SPA `?raw` import and the sidecar SSR. | Required by the LinkedIn OAuth app submission. Edit here when the policies need to change; CI rebuild copies them into the sidecar's container layer. |

## Technical & operator

| Document | What's in it | When you'd read it |
|---|---|---|
| [`operator-checklist.md`](./operator-checklist.md) | Setup steps · Google OAuth · mem0 deploy · capabilities · gaps · risks · definition of production-ready | Taking LearnAI from demo to real product. |
| [`architecture.md`](./architecture.md) | High-level diagram · box-by-box · failure modes · data classification · what changes for Sprint 2 | Onboarding an engineer. Reviewing a structural PR. |
| [`technical.md`](./technical.md) | The engineer view: MemoryService interface · offline flag wiring · perf budget · rollout · tests | Implementing a feature that touches cognition. |
| [`mem0.md`](./mem0.md) | Why mem0 · what we store + don't · self-host (docker-compose, Fly) · SHA-pinning · backups · GDPR | Running mem0 in any environment. |
| [`ux.md`](./ux.md) | UX of the cognition layer: where memory shows up, the privacy ethic, edge cases | Designing or reviewing memory-touching UX. |
| [`mem0-fork-publish.workflow.yml`](./mem0-fork-publish.workflow.yml) | Drop-in GitHub workflow to publish your mem0 fork to GHCR | Before deploying mem0 self-hosted. |
| [`cloud-claude-mcp.md`](./cloud-claude-mcp.md) | The Cloud-Claude MCP — 36 tools for read + mutate of the deploy · audit recipe (`describe_project` → `get_logs`) · safety rules · patterns (rotate JWT_SECRET, add domain, fix stuck deploy, rollback) | Whenever the deploy needs introspection or a platform-side action. Integral to the autonomous-delivery directive in [`../CLAUDE.md`](../CLAUDE.md). |
| [`../services/social-svc/README.md`](../services/social-svc/README.md) | Node + Express social-graph sidecar (bundled in the SPA container) · 21 endpoints (19 REST + SSR `/u/<handle>` + sitemap) · session-JWT auth · in-memory + JSON-file MVP · Postgres-2 swap path | Running or extending `social-svc`. |
| [`operator-checklist.md`](./operator-checklist.md) | Production deploy steps · env vars to set on cloud-claude · what logs to monitor · rollback · moderation SLA | Operating LearnAI in production. |

## Community

| Document | What's in it | When you'd read it |
|---|---|---|
| [`contributing.md`](./contributing.md) | Five flavors of contribution · house rules · authoring a Spark · review criteria · code of conduct | Before opening your first PR. |
| [`fork-recipe.md`](./fork-recipe.md) | The 30-minute fork · what you keep for free · what to customize · recommended initial domains · sharing back | Forking the engine for a new domain. |

## Content model & sources

| Document | What's in it | When you'd read it |
|---|---|---|
| [`aha-and-network.md`](./aha-and-network.md) | **The active priority bet.** 90/10 framing (individual aha vs network); 10 items prioritized; content-quality review; FTUE critical re-review with a button-bloat audit; 4-week ship plan. Living doc — the next four weeks of work ladder here. | Anyone scoping or reviewing growth / aha / FTUE / content work in the next four weeks. **Read first** before opening a feature PR. |
| [`growth-plan-cpo-q1.md`](./growth-plan-cpo-q1.md) | The 5-idea CPO memo — Cold-Start Aha · Spark Cards · Daily Pulse · Build-and-Ship Loop · Cohort Quests. Two items carried into the active queue in [`aha-and-network.md`](./aha-and-network.md); three deferred until that queue lands. | Reviewing the 5-idea horizon. The "where we're going *after* the active 4 weeks" doc. |
| [`content-model.md`](./content-model.md) | **The operating manual for what content *means* at LearnAI.** Compression-not-curriculum thesis · five principles · the user's three choices on every Spark (✅/🔍/⏭) · the source pipeline · just-in-time vocabulary · cognition's role · what we are NOT · the next-PR queue with KPI mappings | Anyone designing a new Spark format, a new content surface, the recommender, or the cognition layer. Read **first** if you're going to touch any of it. |
| [`first-time-builder-findings.md`](./first-time-builder-findings.md) | A driven-the-live-SPA audit by a fresh builder persona — 33 numbered findings, four near-aha moments, top-10 prioritized changes mapped to `metrics.md` | Before reviewing or scoping the next content-experience PR. The empirical ground truth behind `content-model.md` §8. |
| [`test-personas.md`](./test-personas.md) | Internal QA personas (Maya, Jordan) for repeatable FTUE dogfooding · success/failure tells · operating rules · dated findings log. Personas live on `app/src/lib/hidden-accounts.ts` so they're filtered from every public surface (leaderboard, profile SEO, cross-viewer profile fetches) | Before running an FTUE pass, after spotting a regression, or when adding a new dogfood account. |
| [`content-experience-plan.md`](./content-experience-plan.md) | The three-workstream plan that turned LearnAI from "a hand of cards" into a stitched session experience: mem0-driven session sequencer · `PodcastNugget` Spark variant + admin feature flag · 👍/👎 feedback loop with permanent skip on 👎. Many items now subsumed into [`content-model.md`](./content-model.md) §8 — read this for the historical record | Historical reference; new work should ladder to [`content-model.md`](./content-model.md) |
| [`lenny-archive.md`](./lenny-archive.md) | The Lenny's Podcast transcripts archive · `PodcastNugget` Spark spec · curation rubric · attribution policy · topic mapping · 12 seed nuggets. **First source-anchored Spark variant** — every future `VideoNugget` / `PaperNugget` / `ReleaseNote` / `EssayNugget` / `NewsletterNugget` inherits this shape | Before authoring or reviewing any source-anchored Spark. The canonical staging area for any nugget before it lands in `content/topics/*.ts`. |
| [`content-freshness.md`](./content-freshness.md) | **Sprint #2 content engine doctrine.** Five rules — honest about age, diverse to neighbors, tonally calibrated by age band, source-anchored, self-improving via meta-implicit refinement · per-category shelf life · 7 critique chips · YouTube nugget pilot · external-source creators registry · Sprint #2 deliverables checklist | Before adding a Spark, integrating a new external source, tuning the freshness chip, or extending the critique loop. |

## Legacy / deep reference

These pre-date the structured wiki but contain useful detail. Read them when the wiki sends you here.

| Document | What's in it |
|---|---|
| [`../HOW_IT_WORKS.md`](../HOW_IT_WORKS.md) | Long-form install + configure + mechanics + operator guide. |
| [`../DESIGN_DOC.md`](../DESIGN_DOC.md) | The original game-design rationale (terminology, mechanics, philosophy). |
| [`../SPRINTS.md`](../SPRINTS.md) | The first sprint plan (now superseded by [`roadmap.md`](./roadmap.md), kept for context). |

## Quick links by scenario

**"I want to try LearnAI right now."**
→ Live: `https://learnai-b94d78.cloud-claude.com`. Or run `npm install && npm run dev` from the repo root.

**"I'm a contributor — show me where to start."**
→ [`contributing.md`](./contributing.md) → [`mvp.md`](./mvp.md) → [`technical.md`](./technical.md) → ship a Spark.

**"I'm an engineer — show me the system."**
→ [`architecture.md`](./architecture.md) → [`technical.md`](./technical.md) → [`mem0.md`](./mem0.md) → [`social-mvp-engineering.md`](./social-mvp-engineering.md) → run `npm test` (591 SPA + 137 social-svc = 728).

**"I'm an investor / partner — show me the case."**
→ [`pitch-deck.md`](./pitch-deck.md) → [`vision.md`](./vision.md) → [`competitors.md`](./competitors.md) → [`mvp.md`](./mvp.md) → [`metrics.md`](./metrics.md).

**"I'm an educator — I want to fork this for my domain."**
→ [`fork-recipe.md`](./fork-recipe.md) → [`vision.md`](./vision.md) → fork the repo on GitHub.

**"I'm building / using AI and feel behind."**
→ Just open the live URL and sign in with Gmail. Five minutes a day from there.

---

[← back to repo root](../README.md)
