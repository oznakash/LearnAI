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

### ✅ Closed in Sprint 2.5 PR 12

| Item | Status |
|---|---|
| Telemetry dashboards in admin | ✅ `/v1/social/admin/analytics` endpoint + AdminAnalytics social panel |
| `ALLOW_DEMO_HEADER` / startup state visible on `/health` | ✅ `/health` now returns `jwt_configured`, `demo_trust_header`, `admins`, `backend`, `misconfig` |
| Server-side stream Signal-overlap path + spotlight cron | ✅ Stream now blends approved-follows + Signal-overlap + spotlight (PRD §4.5 paths 1, 2, 3) |

### Postponed (revisit when we need to scale)

| Item | Why deferred |
|---|---|
| Postgres-2 migration on `social-svc` | Founder call: avoid building another service / DB until scale demands it. Current path (in-memory + JSON-file on the mounted `/data` volume) is durable across container rebuilds and fine for the first ~10k profiles. The `Store` interface remains the seam — flipping in a Postgres-backed implementation later is a single-module change. |

**Done when:** social flags are flipped on in production. The remaining items in `social-mvp-status.md` are P2/P3 (logging hygiene, mock-filler sort, etc.) — none block the flip.

---

## Sprint 2.6 — Identity & operational hardening (NEW, follows 2.5)

**Goal:** harden the cross-service identity guarantees from the entity-wiring audit ([`entity-wiring-audit.md`](./entity-wiring-audit.md)). Three months of accumulated drift surfaced as a single empty-leaderboard report; that audit closed seven bugs (A–G) plus added an inline mem0 → social-svc fan-out, a daily reconcile, and a cascade-delete admin path. This sprint closes the *next-most-likely-recurring* seams + the operator visibility gaps. None block production, but each is one fewer surprise the next time we do an audit.

### P1 — refactor + identity backfill

| # | Item | Why now |
|---|---|---|
| 2.6-1 | **Move `handles.ts` and `hidden-accounts.ts` into a shared workspace package** | Today both files are duplicated in `app/src/social/` and `services/social-svc/src/`, drift-protected by tests. Every new behavior added to handle generation needs both copies updated; the longer the duplication lives, the higher the chance of drift. Workspace package eliminates the duplication entirely. Pure refactor — drift tests delete; SPA + sidecar import from one place. |
| 2.6-2 | **Backfill identity for the 8 existing users (`display_name` = NULL today)** | Sister problem to #21 in mem0 — that PR persists Google identity going forward, but the 8 users who signed up before it shipped have NULL `display_name` until they re-sign-in. They show as title-cased handles ("Hmatasmagen") on every public surface. Two viable paths: (a) email each user a "we improved profiles, please re-sign-in" link with one-click reauth; (b) extend `/auth/session` to refresh-and-persist on the existing JWT's next call. Option (b) is invisible to the user; pick that. |

### P2 — operator surfaces + cold-start polish

| # | Item | Why now |
|---|---|---|
| 2.6-3 | **`/auth/google` fanout also pushes initial xp/streak/14d snapshot** | Today the inline fan-out from mem0 → social-svc carries identity only. A fresh Google signin lands the profile in social-svc instantly, but xp / streak / activity_14d wait until the SPA's first `pushSnapshot`. Means the leaderboard / Stream presence is delayed by one navigation. Adding a server-side snapshot push closes the gap. |
| 2.6-4 | **Reconcile alert wired to email or Slack on `created.length > 0` or `errors.length > 0`** | The daily reconcile cron alerts the operator's session today, which is silent unless the operator is watching. Wiring to mem0's existing email service (or Slack webhook) means drift gets surfaced within 24 hours, every time. Spec: only alert when non-zero — steady-state silent. |
| 2.6-5 | **Biweekly automated entity-wiring audit cron** | The first audit was prompted by an "empty leaderboard" report. The fix landed but the system trusts that no future regression introduces a new seam. A scheduled audit run (every 14 days, separate from the daily reconcile) re-checks the invariants: every mem0 user has a social-svc profile, every profile has a `/u/<handle>` 200, no smoke-test profiles, no drift in handle gen. Outputs a delta report; alerts on anything non-empty. |

### Postponed (decision: revisit at Sprint 5)

| Item | Why deferred |
|---|---|
| Avatar re-host shim — `lh3.googleusercontent.com` URLs rotate ~30 days after signin and break avatar rendering | Not currently visible (no user reports). Pairs naturally with the image-hosting infrastructure work in Sprint 5 ("server-side content fetcher" already lives there). Move it to that sprint when fetched-content image hosting is being designed — they share the proxy-and-cache shape. |

**Done when:** Sprint 2.6's five P1+P2 items land, the daily reconcile is silent for 14 consecutive runs, and the next entity-wiring audit (manual or automated) finds zero drift.

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

**Goal:** make the Spark Stream actually compound — user-authored Sparks land here, not just derived events. Plus the server-side content fetcher that lets the daily steward pull from any source.

| Item | Why |
|---|---|
| User-authored Spark cards on Stream (Tip, Build-share, MicroRead with Sparkline) | Sprint 2 punted this. The Stream MVP is event-derived; this is what makes it a real feed. |
| Comments + reactions (small, on Sparks only — not on derived cards) | Vision §4 still holds: zero engagement-feedback in ranking. Reactions are signal *to the author*, not a feed-ranking input. |
| Spotlight cron — top mover per Topic per week → emit `kind="spotlight"` rows | Engineering plan §4.5; punted in Sprint 2. |
| Notifications system (digest email + in-app dot) for new follows, new Spark Stream cards from authors you follow | Demand-gated by Sprint-2 retention curves. |
| Cross-device push (iOS + Android via PWA push first, native later) | Pairs with mobile shell in Sprint 6. |
| **Server-side content fetcher** — a small sidecar service that fetches arbitrary URLs (with proper UA + headless-browser fallback for client-rendered sites) and returns plain HTML/text. The daily steward currently uses `WebFetch` directly, which works for RSS / Atom / JSON APIs (see `app/src/content/feeds.ts`) but fails on JS-rendered pages like AlphaSignal, YouTube channel pages, HN homepage. With this sidecar, the steward can ingest any source — not just the ones with a feed. | Lifts the steward from "RSS + JSON only" to "any URL on the open web". Unblocks the literal 5× content corpus path: ingest from any creator, any aggregator, any post URL. |

**Done when:** community-authored Sparks outpace event-derived cards on the median Stream visit, AND the daily steward can pull from at least one JS-rendered source via the new fetcher.

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
