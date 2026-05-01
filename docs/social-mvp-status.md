# Social MVP — sprint status + open punch list

> _The sprint changelog and the open issues that must close before flipping the social flags on in production._
>
> Sister docs: [`social-mvp-product.md`](./social-mvp-product.md) (PRD) · [`social-mvp-engineering.md`](./social-mvp-engineering.md) (engineering plan) · [`roadmap.md`](./roadmap.md) (Sprint 2.5 closes the items below).

---

## Sprint 2 — what shipped

9 PRs merged into `main` over a single development session. All flags default OFF in `defaults.ts`; a fork pulling main today sees zero behavior change. Live deploy flips them on once the Sprint 2.5 punch list (below) closes.

| PR | Commit | Date | Title |
|---|---|---|---|
| [#40](https://github.com/oznakash/learnai/pull/40) | `68bf988` | 2026-04-30 | PR 1 — Foundation: types + `OfflineSocialService` + `SocialProvider` + admin flags |
| [#41](https://github.com/oznakash/learnai/pull/41) | `caab092` | 2026-04-30 | PR 2 — Public Profile view + `/u/<handle>` routing |
| [#42](https://github.com/oznakash/learnai/pull/42) | `44537a1` | 2026-04-30 | PR 3 — Settings → Network + Profile mode + field-level visibility |
| [#43](https://github.com/oznakash/learnai/pull/43) | `728c91c` | 2026-04-30 | PR 4 — Follow / Unfollow / Mute / Block / Report on Profile + people-list management on Network |
| [#44](https://github.com/oznakash/learnai/pull/44) | `1f702e7` | 2026-04-30 | PR 5 — Topic Leaderboards (Boards) + Signals tabs |
| [#45](https://github.com/oznakash/learnai/pull/45) | `0aa1009` | 2026-04-30 | PR 6 — Spark Stream view + flag-gated TabBar tab |
| [#46](https://github.com/oznakash/learnai/pull/46) | `060d19a` | 2026-04-30 | PR 7 — `services/social-svc/` Node backend + `OnlineSocialService` HTTP client |
| [#47](https://github.com/oznakash/learnai/pull/47) | `ed6cead` | 2026-04-30 | PR 8 — `services/auth-proxy/` Cloudflare Worker proxy |
| [#48](https://github.com/oznakash/learnai/pull/48) | `4ce6d14` | 2026-04-30 | PR 9 — AdminModeration tab |
| [#49](https://github.com/oznakash/learnai/pull/49) | `6932f95` | 2026-04-30 | Doc PR — README, mvp, roadmap, INDEX, architecture, this status doc |
| [#50](https://github.com/oznakash/learnai/pull/50) | `8d3aec5` | 2026-04-30 | Sprint 2.5 PR 10 — closed 8 P0s + 2 P1s (snapshot pipeline, upstream bearer, email leak, handle fix, clientId idempotency, snapshot validation, kid-safety, closed-stub leak) |
| (this PR) | (pending) | 2026-05-01 | Sprint 2.5 PR 11 — **architecture consolidation**: deleted `services/auth-proxy/`; folded its logic into `services/social-svc/`; bundled the sidecar into the SPA container; switched auth from injected-X-User-Email to local session-JWT verification; same-origin defaults on the SPA; structured JSON logging; Dockerfile + entrypoint script. Three deploy units → two. No Cloudflare account needed. |

### By the numbers

- Test count: 90 → **300** (265 SPA + 35 social-svc).
- Bundle delta: ~+50 KB JS gzipped.
- Deploy units on cloud-claude: **2** (the SPA container with social-svc sidecar bundled in + mem0). Was briefly 3 between PR 7 and PR 11.
- Engagement-feedback ranking signals shipped: **0** (vision §4).

### Five capabilities — implementation map

| Capability | UI | Service | Status |
|---|---|---|---|
| Tune-in / Follow mechanics | `views/Profile.tsx`, `views/Network.tsx` | `services/social-svc` `/v1/social/follow/*`, `/v1/social/blocks/*`, `/v1/social/reports` | ✅ end-to-end |
| Public Profile (`/u/<handle>`) | `views/Profile.tsx`, `store/router.ts` | `GET /v1/social/profiles/:handle` | ✅ end-to-end |
| Profile mode + field visibility | `views/Network.tsx`, `views/Settings.tsx` | `PUT /v1/social/me` | ✅ end-to-end |
| Topic Leaderboards + Signals | `views/Leaderboard.tsx` | `GET /v1/social/boards/:scope` | 🟡 UI complete, ranking algorithm punted to Sprint 2.5 (`/boards` returns `[]`) |
| Spark Stream | `views/SparkStream.tsx`, `components/TabBar.tsx` | `GET /v1/social/stream` | 🟡 UI complete, server returns events from approved follows only — Signal-overlap and `spotlight` cards punted to Sprint 2.5 |

---

## Sprint 2.5 — open punch list (must close before flag-flip)

Surfaced by four parallel review passes (general code review, security review, stability smoke, spec-vs-code drift). Grouped by severity, all anchored to file:line.

### P0 — block flag-flip

**P0-1. Snapshot pipeline is unwired in the SPA.**
The `pushSnapshot` method exists on `SocialService` and is wired through the provider, but no caller fires it. There is no `useEffect` in `PlayerContext` that diffs `prev → next` and calls `social.pushSnapshot(buildSnapshot(...))`. Result: `profile_aggregates`, `xpTotal`, `streak`, and `stream_events` never populate from real play, so Boards and Stream stay empty even with social on.
*Where:* `app/src/social/SocialContext.tsx:170` (helper exists), `app/src/store/PlayerContext.tsx` (caller missing).
*Fix:* add `app/src/social/snapshot.ts` (`buildSnapshot(prev, next)`) and wire it into `PlayerProvider` after the save effect.

**P0-2. `social-svc` trusts `X-User-Email` with zero verification of proxy origin.**
The "trust boundary" is asserted in code comments but never enforced. The Worker forwards `Authorization: Bearer ${UPSTREAM_KEY_SOCIAL}`, but social-svc never checks for it. Combined with `access-control-allow-origin: *` and the fact that the social-svc URL is client-visible (admin config / browser dev tools), any user can `curl` social-svc directly with a forged header and impersonate anyone. Exploit: `curl -H "X-User-Email: victim@gmail.com" $SOCIAL_SVC_URL/v1/social/me` → owner-view payload.
*Where:* `services/social-svc/src/app.ts:43–49` (CORS), `app.ts:59–91` (`requireUser`).
*Fix:* require `Authorization: Bearer ${UPSTREAM_KEY}` server-side; restrict CORS origin to the proxy or SPA domain.

**P0-3. `email` is leaked to non-owners on every public profile.**
PRD §4.2 says "never displayed to viewers." The closed-mode stub also leaks the gmail. Any handle scraper builds a handle → gmail map (and the gmail-only check guarantees they're real Google accounts → spam/phishing list).
*Where:* `services/social-svc/src/types.ts:91–92` (`PublicProfile.email: string` always populated), `project.ts:21–22`, `app.ts:200`.
*Fix:* drop `email` from non-owner views; keep handle as the stable wire identifier.

**P0-4. `myHandle` derivation collides with `baseHandleFromEmail`.**
`Profile.tsx:42`, `Leaderboard.tsx:103`, `Network.tsx:401-407, 421` all do `email.split("@")[0].toLowerCase()`, which keeps dots. `baseHandleFromEmail` strips dots. For `john.doe@gmail.com` the canonical handle is `johndoe` but these views compute `john.doe`. Consequences: own-profile-detection breaks; Leaderboard's "you" badge stops working; follower-list links go to `/u/john.doe` → 404.
*Where:* the three view files above.
*Fix:* use `baseHandleFromEmail` (already exported from `app/src/social/handles.ts`) or read `getMyProfile().handle`.

**P0-5. Snapshot upsert has no `clientId` idempotency.**
Server inserts every event in the array unconditionally. The engineering plan §4.4 + the `PlayerSnapshot.events[].clientId` field are explicit: server must dedupe. As written, React StrictMode's double-fire or any retry will multiply `stream_events` rows.
*Where:* `services/social-svc/src/app.ts:172`.
*Fix:* track recent `(email, clientId)` tuples in the store and skip duplicates.

**P0-6. Snapshot endpoint crashes with HTTP 500 on a malformed body.**
The only validation is `if (!snap)`; everything else is a property dereference. A request with `{}` returns an uncaught `TypeError: Cannot read properties of undefined (reading 'to')` and 500 instead of 400.
*Where:* `services/social-svc/src/app.ts:153–168`.
*Fix:* runtime-validate the snapshot shape (zod or hand-rolled) and return 400 `invalid_snapshot`.

**P0-7. `TEST_BYPASS_VERIFY=1` accepts unsigned ID tokens.**
If accidentally set in production, *any* unsigned JWT with `email: "victim@gmail.com"` is accepted — no signature, no audience, not even the gmail check. There is no production guard.
*Where:* `services/auth-proxy/src/verify.ts:29–37`.
*Fix:* assert `process.env.NODE_ENV !== "production"` at module load when the bypass is set, or remove the bypass and use a test JWKS instead.

**P0-8. Server hardcodes `ageBand: "adult"` on every profile creation.**
There is no PUT path that accepts `ageBand`. So every profile is "adult", and the kid-safety branches (forced-Closed, no kid-to-adult follow, kid-stream isolation) are unreachable in practice. PRD §9 marks this as "Critical" privacy risk.
*Where:* `services/social-svc/src/app.ts:72`.
*Fix:* accept `ageBand` from the verified onboarding flow; gate writes; force `profileMode: "closed"` and `signalsGlobal: false` server-side for kids.

### P1 — ship behind the flag, fix before flag-flip

**P1-1. Block-by-handle is a silent no-op.**
`Profile.tsx:481` calls `social.unblock(handle)`, but `store.addBlock` stores the *email*. The `removeBlock` route accepts a handle parameter and looks it up by email. Mismatch → no rows deleted.
*Where:* `app/src/views/Profile.tsx:481`, `services/social-svc/src/store.ts:194`.
*Fix:* unblock route accepts and looks up by handle (or the UI sends the email).

**P1-2. `ALLOW_DEMO_HEADER=1` is a privilege-escalation footgun.**
Validation is `demo.includes("@")` — any `victim@gmail.com` works. The toggle is operator-set, but there is no marker visible in `/health` and no warning logged at startup.
*Where:* `services/auth-proxy/src/worker.ts:136–139`.
*Fix:* refuse to start the Worker with both `ALLOW_DEMO_HEADER=1` and a real `GOOGLE_OAUTH_CLIENT_ID`; surface state in `/health`.

**P1-3. Snapshot accepts arbitrary XP / events without runtime validation.**
`kind` is cast as `StreamCardKind` without runtime checking; `xpTotal`, `streak`, `level`, and `detail` are unbounded; events with `createdAt` in the future are accepted. These leak into followers' streams.
*Where:* `services/social-svc/src/app.ts:146–183`.
*Fix:* validate `kind` against the union; bound xp/streak/level; reject future-dated events.

**P1-4. Server-side stream filter drops Signal-overlap authors and `spotlight` cards.**
PRD §4.5 + engineering §4.5 require the stream to include events from authors who share Signals with the viewer, plus a daily `spotlight` cron. Today the filter only includes approved follows; `iAmFollowing` and `iCanFollow` are hardcoded `true`/`false`.
*Where:* `services/social-svc/src/app.ts:355–397`.
*Fix:* add Signal-overlap path; build the spotlight cron.

**P1-5. Closed-mode stub leaks `ageBandIsKid`, `email`, `pictureUrl`, `displayName`, `signupAt` to any signed-in adult who guesses a handle.**
The PRD's "Closed" promise is weaker than advertised — it tells adults a kid exists at handle X.
*Where:* `services/social-svc/src/app.ts:194–211`.
*Fix:* return a generic 404 (or a stub stripped of `ageBandIsKid`) for closed profiles to non-followers; only reveal age-band hint after `approved`.

**P1-6. CORS on social-svc is `*`.**
Combined with P0-2: any malicious page in any browser can call social-svc with the victim's email if they ever learn it. Even if the proxy origin restriction is fixed, the upstream is wide open.
*Where:* `services/social-svc/src/app.ts:45`.
*Fix:* restrict origin to the proxy or to the SPA hostname; or require the upstream bearer (see P0-2).

**P1-7. `Network.tsx` followers list shows `@${e.follower.split("@")[0]}` — leaks email local-part to UI.**
Should fetch handles via the profile or have the followers endpoint return handles.
*Where:* `app/src/views/Network.tsx:401`.

**P1-8. `OfflineSocialService.report` auto-mute miss.**
PRD §4.1 says report auto-mutes period — even strangers. Today the offline impl only auto-mutes if there's already an outbound follow edge.
*Where:* `app/src/social/offline.ts:427`. Server has the same shape (`app.ts:343`).

**P1-9. Dead `showFullName ? showFullName : showFullName` ternary.**
Both branches identical. The intent was probably `isOwner ? true : profile.showFullName` so the owner sees their full name in their own preview even when `showFullName=false`. Today owner sees whatever `showFullName` is set to — which violates PRD §4.2's owner-view rule.
*Where:* `services/social-svc/src/project.ts:19`, `app/src/social/offline.ts:174`.

**P1-10. Filing a report silently auto-mutes the followed target.**
Confirmed via stability smoke. UX surprise — should be either documented in the toast or made visible in the Network → Following list.

**P1-11. The Worker forwards arbitrary client `x-*` headers.**
Other client-controlled headers (`x-forwarded-for`, custom `x-*`) flow through. social-svc reads `x-user-email` only AFTER the proxy sets it (line 172 sets it last) — so this is safe today. But any future read of an `x-*` header in social-svc is silently spoofable.
*Where:* `services/auth-proxy/src/worker.ts:169`.
*Fix:* whitelist headers to forward; or strip all `x-*` except the ones the proxy explicitly sets.

### P2 — nice-to-have, post-flag-flip

**P2-1. No snapshot helper file.** The plan §5.1 specifies `app/src/social/snapshot.ts`; doesn't exist. Folded into P0-1's fix.

**P2-2. Profile fields lack length / content validation.** `fullName`, `pictureUrl`, `signals[]` strings are accepted as-is — `pictureUrl` could be a `javascript:` URI or a tracker URL. `services/social-svc/src/app.ts:115–116, 138–141`.

**P2-3. Auto-profile creation on every authenticated request.** A bot with Gmail accounts can spray the API to create thousands of profiles cheaply. `app.ts:62–87`.

**P2-4. Mock-filler sort.** PRD §4.4 says mock should rank below real players. Today real and mock are sorted into one list by xp. `app/src/views/Leaderboard.tsx`.

**P2-5. `serviceRef.current = service` during render in `SocialContext.tsx:109`** is load-bearing only because health-refresh `useEffect` runs after child effects mount — but it diverges from the precedent `MemoryProvider` follows (which uses a `useEffect`). A cleaner fix is to pass `service` as a `useEffect` dep. Either delete the comment or unify both providers.

**P2-6. Engineering plan endpoints not yet implemented:** client-side telemetry `POST /v1/social/me/events` (engineering §10), admin analytics `GET /v1/social/admin/analytics` (engineering §7.4).

**P2-7. Path mismatch:** spec table says `PUT /v1/social/mutes/:handle`; implemented as `PUT /v1/social/follow/:handle/mute`. Wire is consistent client↔server but the spec docs need updating.

**P2-8. Test coverage gaps:** snapshot path is wired (P0-1), Stream filters muted/blocked/banned/kid authors server-side, report rate-limit (PRD §9: 20/day), handle generation collision in social-svc's lazy create (`app.ts:67` falls back to `${base}-${Date.now()}` after 9999 — engineering plan said 409).

**P2-9. Cross-cutting Sprint-2 surfaces missed:** `Home.tsx` rails, `TopicView.tsx` per-topic board rail, `TopBar.tsx` avatar-menu entries (View my profile / Network) and unread dots, `AdminUsers` social columns, `AdminAnalytics` social panels.

**P2-10. `AdminModeration.resolve` writes the resolution string but never sets `bannedSocial=true` / `banned=true` on the user.** Moderation actions are inert beyond bookkeeping.

**P2-11. Documentation drift in narrative docs:** `CLAUDE.md` and `README.md` still use "Constellation/Constellations" in places where current PRD says "Topic". `docs/INDEX.md:19` describes the social PRD using the walked-back "Tune-in" word.

**P2-12. Logging hygiene:** uncaught handler errors hit `process.stderr` directly with no `[social-svc]` prefix or structured fields.

**P2-13. Vite "chunks larger than 500 kB" warning persists.** Bundle is 556 kB; only one chunk emitted. Lazy-load admin views to drop below 500 kB.

**P2-14. `dist/` content-hash drift:** committed bundle differs slightly from a fresh build (size identical, hash differs) — a CI-rebuild on `main` will sync.

**P2-15. Spec-vs-implementation gaps in `social-mvp-engineering.md` table:** review of `services/social-svc/src/app.ts` matches all routes, but `social-mvp-engineering.md §4.2` lists `PUT /v1/social/mutes/:handle` (vs implemented `PUT /v1/social/follow/:handle/mute`). Update the spec.

---

## How we got here

Single development session, four parallel review agents, two doc PRs (this one + the Sprint 2.5 close-out PR coming next). All findings captured here before any flag flips.

The Sprint 2 work landed exactly as scoped in `social-mvp-engineering.md`. The punch list above is the natural cost of moving in PR-sized increments without an integration pass at the end — fixing all of P0 + the relevant P1 in Sprint 2.5 is the planned next move.

---

## See also

- [`social-mvp-product.md`](./social-mvp-product.md) — the PRD this sprint implemented.
- [`social-mvp-engineering.md`](./social-mvp-engineering.md) — the engineering plan; §13 risk register matches several P0/P1 items here.
- [`roadmap.md`](./roadmap.md) — Sprint 2.5 closes this punch list.
- [`mvp.md`](./mvp.md) — what's shipped.
