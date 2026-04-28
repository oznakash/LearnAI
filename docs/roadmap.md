# Roadmap

> _What we ship next, in five sprints. Each sprint is a 2–3 week unit._

The MVP ([`mvp.md`](./mvp.md)) is shipped. From here, we layer the social graph + talent layer + content compounding + multi-shell — each sprint moving us toward the [vision](./vision.md).

---

## Sprint 1 — Cognition turned on

**Goal:** mem0 default-on, first memory-derived insights showing up on Home, telemetry to start tuning the recommendation logic.

| Item | Why |
|---|---|
| Wire onboarding/calibration/play hooks to default-on memory writes (already coded; just flip the offline flag default in production) | The cognition layer is already plumbed — it needs to be *used*. |
| Home "Today, for you" card surfaces 1 memory-derived insight + a heuristic fallback | The "you know me" moment for the player. |
| In-session nudge: every 6 Sparks, the mascot offers a memory-tied suggestion (skip ahead, re-explain, switch topic) | Real-time use of `recall()`. |
| "Why?" expand on every recommendation, showing the linked memories | Read-write parity → trust. |
| Telemetry: accept / dismiss rate per insight type | We need data to tune. |
| Privacy switch in Your Memory (per-player opt-in/out, gated by `memoryPlayerOptIn`) | The right thing to do. |

**Done when:** by day-7 of any new user with cognition on, at least one Home insight clearly references a stored memory.

---

## Sprint 2 — Real cohort

**Goal:** ship the multi-tenant boundary, first real (not bot) leaderboard, public builder profiles.

| Item | Why |
|---|---|
| Auth-verifying proxy in front of mem0 (Cloudflare Worker, ~50 lines) — verifies Google ID token, injects `user_id`, rate-limits per Gmail | Prerequisite for any multi-user feature. Drops the bearer-in-browser model. |
| Public profile schema (separate Postgres alongside mem0) — email-hash, name, picture, tier, streak, mastered Constellations, badges, opt-in flag | Foundation of the social layer. |
| `/profile/<handle>` public page (read-only) | First shareable artifact. |
| Real cohort leaderboard (this week / this month / all-time) | Replaces bot Guild. |
| Settings → Privacy: opt in/out of public profile, granularity per field | Trust. |
| "Share this Spark" button (links to a public, no-auth view of the Spark) | Word-of-mouth growth. |

**Done when:** any signed-in user can share a public link to their profile that another user (or no one) can see.

---

## Sprint 3 — The community curriculum

**Goal:** community-contributed Sparks, AI-assisted review, attribution. The curriculum starts compounding.

| Item | Why |
|---|---|
| Contribution UX — players can author a Spark from the Prompt Studio, not just the admin | The "teach moment" in [`use-cases.md`](./use-cases.md). |
| AI-assisted review pipeline — generated Sparks scored on accuracy, originality, level-fit by a reviewer LLM, queued for maintainer pass | Quality bar at scale. |
| Attribution — every Spark shows its author + co-authors (the AI is a co-author) | Real reputation, real signal. |
| Top-contributor leaderboard, top-contributor badge ladder | Incentive. |
| Forking improvement — once-monthly upstream sync of community contributions to all forks | The fork ecosystem becomes self-improving. |

**Done when:** community contributions outpace maintainer-authored Sparks for the first month.

---

## Sprint 4 — Talent Match

**Goal:** the new-LinkedIn-by-accident moment.

| Item | Why |
|---|---|
| Behavioral search index — projects mastered Constellations, completed Build Cards, contribution stats, recent activity per public-opted-in user | The actual signal. |
| Recruiter view — search by stack + capabilities + recency + contribution depth | The hire moment in [`use-cases.md`](./use-cases.md). |
| Verified Build Card completions — signed artifacts (URL → SHA → claim) recruiters can trust | Anti-fake. |
| "I'm interested in roles" toggle on profile (with privacy controls) | Opt-in supply. |
| Recruiter outreach via platform DMs | Demand side. |
| Initial pricing — recruiter platform fee (per outreach or per hire). Free for the first 100 hires across the platform. | Revenue. |

**Done when:** the first hire happens via the platform, with explicit attribution.

---

## Sprint 5 — Multi-surface + accessibility

**Goal:** meet the player where they are. Mobile native, voice mode, on-device personalization.

| Item | Why |
|---|---|
| iOS + Android shells (PWA → Capacitor → React Native depending on traction) | Phone-first habit. |
| Voice mode — listen-and-answer (read aloud the MicroRead, accept voice answers on Quick Picks) | Accessibility + commute. |
| On-device cognition — option to run mem0 fully on-device (small models) for privacy-strict users | Differentiator vs. any cloud-only competitor. |
| Localization — internationalize the UI, then localize seed Sparks via the Prompt Studio | TAM expansion. |
| Stripe / billing — Pro tier, Org seats | First revenue line. |

**Done when:** the daily-habit retention curve looks the same on a phone as on a desktop.

---

## Beyond Sprint 5 — the platform stage

The five-year arc from [`vision.md`](./vision.md) plays out from here:

- **Year 2:** the fork ecosystem grows (Spanish, kids-AI, on-call drills, sales enablement). We become infrastructure.
- **Year 3:** Talent Match crosses the chasm — companies prefer it over LinkedIn for AI-builder hires.
- **Year 4:** the platform is the default name to point a junior recruiter at for AI roles.
- **Year 5:** the category is named (*evolving cognitive micro-learning*) and we're its default.

---

## What we will NOT do, even if pressured

- We will not become a course platform (Coursera does that).
- We will not become a video site (YouTube does that).
- We will not lock the engine behind a single LLM provider.
- We will not gate the open-source core.
- We will not optimize for time-on-app over shipping rate, retention, and wow-per-minute.
- We will not pivot to enterprise compliance training first; the consumer wedge is the wedge.

---

## How sprints get committed

Every sprint emerges as a **single PR** that:

- Lands behind a feature flag if user-facing.
- Includes the tests (Vitest + behavioral where useful).
- Updates the relevant doc(s) under `docs/`.
- Bumps `mvp.md`'s "Shipped" + "Not yet shipped" sections.

The trail is auditable. **Every claim in `mvp.md` traces to a merged PR.**

---

## See also

- [`vision.md`](./vision.md) — the long-arc reasoning.
- [`mvp.md`](./mvp.md) — what's shipped right now.
- [`pitch-deck.md`](./pitch-deck.md) — the partner-facing version of this roadmap.
