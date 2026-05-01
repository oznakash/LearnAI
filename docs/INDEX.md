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
| [`social-mvp-product.md`](./social-mvp-product.md) | Sprint-2 social MVP from a product-exec lens · Follow / Spark Stream / Topic Leaderboards / Signals · privacy posture · UI surface map · success metrics | Reviewing or building the social network layer. |
| [`social-mvp-engineering.md`](./social-mvp-engineering.md) | Sister doc to the social PRD · Postgres-2 schema · `SocialService` contract · auth-verifying proxy · tests · rollout · risk register | Implementing the social MVP in a single PR. |
| [`social-mvp-status.md`](./social-mvp-status.md) | Sprint-2 changelog (9 PRs) · open P0/P1 punch list from the post-merge review · what Sprint 2.5 closes | Anyone shipping Sprint 2.5 or asking "is the social layer production-ready?" |

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
| [`../services/social-svc/README.md`](../services/social-svc/README.md) | Node + Express social-graph sidecar (bundled in the SPA container) · 19 REST endpoints · session-JWT auth · in-memory + JSON-file MVP · Postgres-2 swap path | Running or extending `social-svc`. |
| [`operator-checklist.md`](./operator-checklist.md) | Production deploy steps · env vars to set on cloud-claude · what logs to monitor · rollback · moderation SLA | Operating LearnAI in production. |

## Community

| Document | What's in it | When you'd read it |
|---|---|---|
| [`contributing.md`](./contributing.md) | Five flavors of contribution · house rules · authoring a Spark · review criteria · code of conduct | Before opening your first PR. |
| [`fork-recipe.md`](./fork-recipe.md) | The 30-minute fork · what you keep for free · what to customize · recommended initial domains · sharing back | Forking the engine for a new domain. |

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
→ [`architecture.md`](./architecture.md) → [`technical.md`](./technical.md) → [`mem0.md`](./mem0.md) → [`social-mvp-engineering.md`](./social-mvp-engineering.md) → run `npm test` (265 SPA + 35 social-svc = 300).

**"I'm an investor / partner — show me the case."**
→ [`pitch-deck.md`](./pitch-deck.md) → [`vision.md`](./vision.md) → [`competitors.md`](./competitors.md) → [`mvp.md`](./mvp.md).

**"I'm an educator — I want to fork this for my domain."**
→ [`fork-recipe.md`](./fork-recipe.md) → [`vision.md`](./vision.md) → fork the repo on GitHub.

**"I'm building / using AI and feel behind."**
→ Just open the live URL and sign in with Gmail. Five minutes a day from there.

---

[← back to repo root](../README.md)
