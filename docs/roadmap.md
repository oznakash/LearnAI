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
| [#47](https://github.com/oznakash/learnai/pull/47) | `services/auth-proxy/` Cloudflare Worker — closes the bearer-in-browser issue. |
| [#48](https://github.com/oznakash/learnai/pull/48) | AdminModeration tab — report queue UI. |

**Done when:** any signed-in user can share a public link to their profile, follow other players, and see a Spark Stream of their network's activity. ✅

→ Full per-PR changelog + open punch list: [`social-mvp-status.md`](./social-mvp-status.md).

---

## Sprint 2.5 — Social production-readiness (NEW, next up)

**Goal:** close the P0/P1 punch list from `social-mvp-status.md` before flipping the social flags on in the live deploy. The flag-flipping moment for Sprint 2.

| Item | Why |
|---|---|
| Wire `pushSnapshot` from `PlayerProvider` after every state change | Without it, `profile_aggregates` and `stream_events` never populate; Boards + Stream are dead even with the flag on. (Code review P0-1.) |
| Require `Authorization: Bearer ${UPSTREAM_KEY_SOCIAL}` server-side in `social-svc` | Today the proxy injects `X-User-Email` but social-svc doesn't verify the upstream bearer; combined with `*` CORS the proxy is bypassable. (Security P0-1.) |
| Remove `email` from non-owner `PublicProfile` payload | PRD §4.2 says "never displayed to viewers"; today every profile fetch leaks the gmail. (Security P0-3.) |
| Add runtime validation to `POST /v1/social/me/snapshot` (zod-like + return 400 on bad shape) | Today a malformed body hits an uncaught `TypeError` and 500s. (Stability P1.) |
| Use `baseHandleFromEmail` consistently in views (replace `email.split("@")[0].toLowerCase()`) | "John.Doe@gmail.com" → handle is `johndoe` not `john.doe`; own-profile detection breaks for any email with dots. (Code review P0-4.) |
| Snapshot upsert dedupes `(email, clientId)` events server-side | StrictMode double-fires multiply `stream_events`. (Code review P0-5.) |
| Strip dead `showFullName ? showFullName : showFullName` ternary | Owner-side preview leaks if intent ever changes. (Code review P1-9.) |
| Postgres-2 migration on `social-svc` (replace the in-memory + JSON-file store) | Production durability. The `Store` interface is already the seam. |
| Operator deploy script — `npm run deploy:social` mirroring `deploy:mem0` | One-command Fly deploy + Wrangler deploy + smoke. |
| `docs/operator-checklist.md` — Social MVP section (deploy / rollback / moderation SLA) | Operations runbook. |
| Telemetry dashboards in admin (per engineering plan §10) | Tune-rate, follow-graph density, stream cards/day, % Closed profiles. |

**Done when:** social flags can be flipped on in production with no P0/P1 from the Sprint-2 review still open. CI green across all three packages. Operator checklist documented.

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
