# Roadmap

> _What we ship next, in seven sprints. Each sprint is a 2–3 week unit._

The MVP ([`mvp.md`](./mvp.md)) is shipped. Sprint 2 (the social layer) is shipped behind feature flags. From here, we harden Sprint 2 for production, layer the talent + community + content-compounding work, and finally widen distribution.

---

## ✅ Sprint 1 — Cognition turned on (done)

**Goal:** mem0 default-on, first memory-derived insights showing up on Home, telemetry to start tuning the recommendation logic.

Status: shipped. mem0 cross-device state, first insights on Home, "Why?" provenance, per-player opt-out, all live.

---

## ✅ Sprint 2 — Real cohort / Social MVP (done, shipped behind feature flags)

**Goal:** ship the multi-tenant boundary, first real (not bot) leaderboard, public builder profiles, the asymmetric follow graph, and the Spark Stream feed.

What landed (9 PRs, 287 tests):

| PR | Capability |
|---|---|
| [#40](https://github.com/oznakash/learnai/pull/40) | Foundation — `SocialService` types, `OfflineSocialService`, `SocialProvider`, admin flags. |
| [#41](https://github.com/oznakash/learnai/pull/41) | Public Profile view + `/u/<handle>` routing. |
| [#42](https://github.com/oznakash/learnai/pull/42) | Settings → Network + Profile mode + field-level visibility. |
| [#43](https://github.com/oznakash/learnai/pull/43) | Follow / Unfollow / Mute / Block / Report mechanics on Profile + Network people-lists. |
| [#44](https://github.com/oznakash/learnai/pull/44) | Topic Leaderboards (Boards) + Signals tabs. |
| [#45](https://github.com/oznakash/learnai/pull/45) | Spark Stream view + flag-gated TabBar tab. |
| [#46](https://github.com/oznakash/learnai/pull/46) | `services/social-svc/` Node backend + `OnlineSocialService` HTTP client. |
| [#47](https://github.com/oznakash/learnai/pull/47) | `services/auth-proxy/` Cloudflare Worker (later consolidated into `services/social-svc/` in Sprint 2.5 PR #11 — see status doc). |
| [#48](https://github.com/oznakash/learnai/pull/48) | AdminModeration tab — report queue UI. |

**Done when:** any signed-in user can share a public link to their profile, follow other players, and see a Spark Stream of their network's activity. ✅

→ Full per-PR changelog + open punch list: [`social-mvp-status.md`](./social-mvp-status.md).

---

## Sprint 2.5 — Social production-readiness (NEW, next up)

**Goal:** close the P0/P1 punch list from `social-mvp-status.md` before flipping the social flags on in the live deploy. The flag-flipping moment for Sprint 2.

### Done in Sprint 2.5 (PRs #50, #11)

| Item | Status |
|---|---|
| Wire `pushSnapshot` from `PlayerProvider` after every state change | ✅ PR #50 |
| Drop the auth-proxy entirely; bundle social-svc into the SPA container as a sidecar | ✅ PR #11 (consolidation) |
| Switch sidecar auth from injected `X-User-Email` to local session-JWT verification (same `JWT_SECRET` as mem0) | ✅ PR #11 |
| Same-origin defaults on the SPA — no separate `serverUrl` to configure in production | ✅ PR #11 |
| Remove `email` from non-owner `PublicProfile` payload | ✅ PR #50 |
| Snapshot validation + clientId idempotency + `kind` runtime-checking | ✅ PR #50 |
| `baseHandleFromEmail` in all views | ✅ PR #50 |
| Kid-safety branch reachable; `ageBand` patchable via PUT /me; kid → forced Closed | ✅ PR #50 |
| Closed-mode stub no longer leaks `email` / `pictureUrl` / `ageBandIsKid` | ✅ PR #50 |
| Strip dead `showFullName` ternary | ✅ PR #50 |
| Structured JSON logging in social-svc; nginx access logs to stdout | ✅ PR #11 |
| `docs/operator-checklist.md` — Social MVP section (deploy / env vars / monitoring / rollback) | ✅ PR #11 |
| Dockerfile bundling nginx + Node sidecar with signal-forwarding entrypoint | ✅ PR #11 |

### Still open (Sprint 2.5 close-out — small follow-up PR)

| Item | Why |
|---|---|
| Postgres-2 migration on `social-svc` (replace the in-memory + JSON-file store) | Production durability beyond a single host. The `Store` interface is already the seam. |
| Telemetry dashboards in admin (per engineering plan §10) | Follow-rate, follow-graph density, stream cards/day, % Closed profiles. |
| `ALLOW_DEMO_HEADER` startup guard that surfaces in `/health` | Operator footgun if accidentally enabled in prod. |
| Server-side stream Signal-overlap path + spotlight cron | PRD §4.5 — the Stream feels sparse without it. |

**Done when:** social flags can be flipped on in production with no remaining P0/P1 from the Sprint-2 review. Container rebuilds pick up the latest /dist/. CI green across both packages.

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

**Goal:** the new-LinkedIn-by-accident moment. Builds on the Sprint-2 follow graph + behavioral profile.

| Item | Why |
|---|---|
| Behavioral search index — mastered Topics, completed Build Cards, contribution stats, recent activity per public-opted-in user | The actual signal — Sprint 2 already exposes the inputs via `social-svc`. |
| Recruiter view — search by stack + capabilities + recency + contribution depth | The hire moment in [`use-cases.md`](./use-cases.md). |
| Verified Build Card completions — signed artifacts (URL → SHA → claim) recruiters can trust | Anti-fake. |
| "I'm interested in roles" toggle on profile (with privacy controls) | Opt-in supply; extends Sprint-2's `ProfilePatch`. |
| Recruiter outreach via platform DMs | First DM surface — explicitly punted from Sprint 2. |
| Initial pricing — recruiter platform fee (per outreach or per hire). Free for the first 100 hires. | Revenue line one. |

**Done when:** the first hire happens via the platform, with explicit attribution.

---

## Sprint 5 — Stream v2 + content compounding

**Goal:** make the Spark Stream actually compound — user-authored Sparks land here, not just derived events.

| Item | Why |
|---|---|
| User-authored Spark cards on Stream (Tip, Build-share, MicroRead with Sparkline) | Sprint 2 punted this. The Stream MVP is event-derived; this is what makes it a real feed. |
| Comments + reactions (small, on Sparks only — not on derived cards) | Vision §4 still holds: zero engagement-feedback in ranking. Reactions are signal *to the author*, not a feed-ranking input. |
| Spotlight cron — top mover per Topic per week → emit `kind="spotlight"` rows | Engineering plan §4.5; punted in Sprint 2. |
| Notifications system (digest email + in-app dot) for new follows, new Spark Stream cards from authors you follow | Demand-gated by Sprint-2 retention curves. |
| Cross-device push (iOS + Android via PWA push first, native later) | Pairs with mobile shell in Sprint 6. |

**Done when:** community-authored Sparks outpace event-derived cards on the median Stream visit.

---

## Sprint 6 — Multi-surface + accessibility

**Goal:** meet the player where they are. Mobile native, voice mode, on-device personalization.

| Item | Why |
|---|---|
| iOS + Android shells (PWA → Capacitor → React Native depending on traction) | Phone-first habit. |
| Voice mode — listen-and-answer (read aloud the MicroRead, accept voice answers on Quick Picks) | Accessibility + commute. |
| On-device cognition — option to run mem0 fully on-device (small models) for privacy-strict users | Differentiator vs. any cloud-only competitor. |
| Localization — internationalize the UI, then localize seed Sparks via the Prompt Studio | TAM expansion. |
| Stripe / billing — Pro tier, Org seats | First revenue line (alongside Sprint-4 recruiter fees). |

**Done when:** the daily-habit retention curve looks the same on a phone as on a desktop.

---

## Beyond Sprint 6 — the platform stage

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
