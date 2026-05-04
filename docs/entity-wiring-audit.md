# Entity-wiring audit — user identities across services

> _2026-05-04. Audit prompted by an empty-leaderboard report._
> _Owner: ftue track. Read this if you're touching identity, sign-in, or any cross-service profile sync._

---

## TL;DR

mem0 had 12 users. social-svc had 3 profiles (one was a smoke-test leftover). **6 real users were cognition-side but socially invisible.** The leaderboard looked empty because of it.

Two real bugs surfaced:

| Bug | Root cause | Fix |
|---|---|---|
| **A. Profile never auto-created when identity has no name/picture** | `app/src/social/SocialContext.tsx`'s identity-sync useEffect only fired `updateProfile()` when the patch had `fullName` or `pictureUrl`. A mem0 user who signed up via email+password (no name claim) hit no social-svc endpoint at all, so `requireUser` lazy-create never ran. | New `ensuredProfileForEmailRef` ref + a parallel `getMyProfile()` call fires once per signed-in email regardless of name/picture presence. |
| **B. `disambiguateHandle` drift between SPA and social-svc** | SPA-side skipped `RESERVED_HANDLES` and clamped suffixes to `MAX_LEN`. Server-side did neither. An `admin@gmail.com` signup got handle `admin` from the server, then `isValidHandle("admin")` rejected it on the SPA — silent UI breakage. | Server `disambiguateHandle` now mirrors the SPA: skips reserved handles + clamps suffixed candidates to 24 chars. |

Plus an operational seam:

- **New admin endpoint** `POST /v1/social/admin/profiles/upsert` — idempotent backfill from `(email, fullName?, pictureUrl?)`. Replaces the JWT-minting dance previously needed to backfill stranded mem0 users.

---

## How a user shows up across services today

A signed-in user touches three independent stores:

1. **mem0** (Postgres-backed) — owns auth + memories. Has its own users table (`/v1/state/admin/users`). Source of truth for "is this user signed in" + "what does this user remember."
2. **social-svc** (in-memory + JSON-file at `/data/social.db.json`) — owns public-shape data: profiles, follows, blocks, reports, signals, stream events. Source of truth for "is this user visible in the social graph."
3. **localStorage** on the user's device — owns gameplay state, calibration, preferences. Source of truth for "where is this user in the curriculum."

These three should agree on **one canonical identity per user**: their lowercased Gmail.

## How they're supposed to stay in sync

- mem0 mints the session JWT (HS256, signed with the shared `JWT_SECRET`).
- social-svc verifies the same JWT locally — `verifySessionJwt` extracts the `email` claim.
- The SPA, on signin, derives the email from the identity payload, persists it in localStorage, and uses it as the "who am I" header on every subsequent request.

The SPA is the synchronizer. Whenever the player state changes meaningfully, the SPA pushes a snapshot to social-svc. Whenever the identity changes (sign-in, sign-out, switch account), the SPA tells social-svc — that's where Bug A lived.

## Bug A — `ensureProfile` regression

### Before

```ts
// app/src/social/SocialContext.tsx (pre-fix)
useEffect(() => {
  ...
  const patch: ProfilePatch = {};
  if (id.name && id.name.trim()) patch.fullName = id.name.trim();
  if (id.picture && id.picture.trim()) patch.pictureUrl = id.picture.trim();
  if (Object.keys(patch).length === 0) return;     // ← short-circuit
  void serviceRef.current.updateProfile(patch);
}, [identity.email, identity.name, identity.picture]);
```

When `identity.name` and `identity.picture` were both absent, the effect short-circuited. **No social-svc call** → `requireUser`'s lazy-create never ran → user is socially invisible.

### After

```ts
// app/src/social/SocialContext.tsx (post-fix)
useEffect(() => {
  ...
  if (ensuredProfileForEmailRef.current !== id.email) {
    ensuredProfileForEmailRef.current = id.email;
    void serviceRef.current.getMyProfile();        // ← fires regardless
  }
  // ... then the prior name/picture patch logic runs unchanged
}, [identity.email, identity.name, identity.picture]);
```

`getMyProfile()` is the cheapest authenticated call. It triggers `requireUser` server-side, which idempotently lazy-creates the profile. Once per email per session.

Pinned by `app/src/__tests__/social.ensure-profile.test.tsx`.

## Bug B — `disambiguateHandle` drift

### Before

| Concern | SPA `app/src/social/handles.ts` | social-svc `services/social-svc/src/handles.ts` |
|---|---|---|
| Skip reserved handles? | Yes (`isReservedHandle`) | **No** |
| Clamp suffix to `MAX_LEN`? | Yes | **No** |

A user with email `admin@gmail.com` got handle `admin` server-side, then the SPA's `isValidHandle("admin")` returned false. Public profile / leaderboard rows would silently break for that user.

### After

Both helpers now share the same algorithm: skip the same `RESERVED_HANDLES` set, clamp the suffixed candidate to 24 chars. Server-side test `entity-wiring.test.ts` cross-reads the SPA file to assert MAX_LEN + Gmail-dot-collapse parity.

## Admin backfill endpoint

`POST /v1/social/admin/profiles/upsert` (admin-only):

```json
{
  "email": "user@gmail.com",
  "fullName": "User Name (optional)",
  "pictureUrl": "https://... (optional)"
}
```

- Idempotent. If the profile already exists, returns `created: false` and only patches the fullName / pictureUrl fields when the existing values are empty.
- Use this to one-shot backfill mem0 users that are missing from social-svc (the "mem0 ghost" case).

## Live state at audit time (2026-05-04)

Pre-fix snapshot of the production store:

- mem0: 12 users (4 smoke profiles + 8 real).
- social-svc: 3 profiles (oznakash, smoke-test-noop, amyu98).
- Gap: **6 real users** missing from social-svc — hmatasmagen, danshtr, orendob, ubershmekel, nakash.caroline, oznakash2.

Cleanup actions taken during the audit:

- Deleted 4 mem0 smoke users (`unsub-flow-…`, `smoke-final`, `em-https-smoke`, `em-policy-smoke`) via `DELETE /v1/state/admin/users/{email}`.
- Deleted `smoke-test-noop` from social-svc via `DELETE /v1/social/admin/profiles/by-handle/smoke-test-noop`.
- Backfilled the 6 missing real users into social-svc by JWT-minting + `GET /v1/social/me` per user, then `POST /v1/social/me/snapshot` with each user's mem0-derived xp/streak/14-day activity.

Post-cleanup: mem0 has 8 real users, social-svc has 8 matching profiles. The leaderboard reflects 7 visible peers + the viewer.

## Bug C — `/u/<handle>` refresh dropped the SPA (2026-05-04)

A second walk-through surfaced three more entries that all ladder to one root cause.

### Symptoms (numbered as the user reported them)

- **#4a** "Follow doesn't persist when I refresh the profile page."
- **#4b** "After refresh I see the public version of the profile, not my own logged-in view."
- **#5** "Browser back doesn't work from a profile page."

### Root cause

`nginx.conf` routes every `/u/<handle>` request to social-svc, which serves a server-rendered HTML page targeted at SEO bots and link-unfurlers. That page is **standalone** — it has no `<script type="module" src="/assets/...">` tag, no `<div id="root">`, no SPA bundle. When a signed-in human refreshes on `/u/danshtr`, their browser receives a static HTML page with no JavaScript, no TopBar/TabBar, no follow button, and no pushState history. The follow they just made is still in social-svc's store, but the SSR page has no way to read it. Browser back has nothing to go back to.

A `curl /u/danshtr | grep '<script'` on prod showed only the JSON-LD schema tag — confirming the bundle was missing.

### Fix

`services/social-svc/src/ssr.ts` reads the SPA's `dist/index.html` once at module load via `getSpaAssets()`, extracts every `<script type="module" src="/assets/...">` and `<link rel="stylesheet" href="/assets/...">` tag emitted by Vite, and caches the result. A new `injectSpaHydration(html, assets)` final-string transform:

1. Inserts the CSS link into `<head>` so the React tree doesn't flash unstyled.
2. Wraps the existing `<body>` inner content in `<div id="root">` so the SPA's `createRoot(...)` mounts at the right node.
3. Appends the JS module before `</body>`.

Both `renderProfileHtml` and `renderNotFoundHtml` now run their output through this transform. Anonymous bots without a JS engine still index the SSR keywords directly — no SEO regression. Pinned by `services/social-svc/__tests__/ssr-hydration.test.ts` (7 tests, including a "no-op when index.html is missing" fallback).

In production the path is `/usr/share/nginx/html/index.html` (per the Dockerfile). For tests / forks the `LEARNAI_SPA_INDEX` env var overrides.

### Issue 1 — leaderboard shows handles, not full names

`resolveDisplayName` returns `fullName` only when `showFullName` is true; otherwise falls back to first-name-only or, if no `fullName` exists at all, the title-cased handle. New profiles created via `requireUser` (lazy-create) and via the admin upsert defaulted to `showFullName: false` — too restrictive for the social fabric the leaderboard is part of. **Default flipped to `true`**; users can still toggle it off in Settings → Network for a privacy-first view. The `fullName` itself populates on the next sign-in via the `ensureProfile` + `updateProfile` chain landed in PR #125.

## Bug D — `FollowEdge.target` was email server-side, handle SPA-side (2026-05-04)

### Symptom

User reported: "Follow is resetting and not registering on refresh." A follow click registered server-side, but the next page load showed the **Follow** button again — never **Following**.

### Root cause

The server-side store keys `FollowEdge` by email (`follower: me.email`, `target: target.email`). Routes like `GET /v1/social/me/following` returned the raw store rows — including the email-shaped `target`. The SPA's offline service stores `target` as a HANDLE (because handles are what URLs and UI text use). `app/src/views/Profile.tsx` therefore does:

```ts
const edge = follow.find((e) => e.target.toLowerCase() === handle.toLowerCase());
```

Pre-fix that compare was email-vs-handle and **never matched.** The follow was correctly persisted; the UI just couldn't see it.

A live diagnostic confirmed it: `GET /v1/social/me/following` for `oznakash@gmail.com` returned three approved follows (`ubershmekel@gmail.com`, `amyu98@gmail.com`, `nakash.caroline@gmail.com`) — the user had been clicking Follow repeatedly, the server had recorded each, but Profile.tsx kept showing the un-followed state.

### Fix

`projectEdge(edge)` and `projectEdges(edges)` in `services/social-svc/src/app.ts` rewrite `target` and `follower` from the stored email to the public handle on every wire response. Applied to `GET /me/following`, `GET /me/followers`, the `POST /follow/:handle` 201 reply, and the idempotent re-follow 200 reply. The store still keys by email internally — only the wire shape changes.

Privacy bonus: cross-viewer reads no longer leak Gmail addresses into client memory.

The legacy `:followerEmail`-shaped approve/decline URLs were generalized to `:follower` and accept either handle or email — a `resolveFollowerEmail(param)` helper handles both, picking the right edge from the store. Pinned by `services/social-svc/__tests__/follow-edge-projection.test.ts` (7 tests, including the exact Profile.tsx-style `target.toLowerCase() === handle.toLowerCase()` lookup).

## Bug F — drift would have recurred without a recurring guarantee (2026-05-04)

The previous fixes closed each individual gap, but the system had no auto-heal: if a user signed up via Google when social-svc was briefly unreachable from the SPA, they'd become a "ghost" again. Two new layers close that hole.

### Layer 1 — inline fan-out from mem0 to social-svc

`mem0/server/routers/google_auth.py` `/auth/google` now fires a fire-and-forget background POST to `<SOCIAL_SVC_URL>/v1/social/admin/profiles/upsert` after issuing the session token, carrying the Google identity (`email`, `name`, `picture`). Idempotent on the receiving side. Never blocks the signin response. Skipped when `SOCIAL_SVC_URL` is unset (same-host setups).

This guarantees that **every fresh Google signin lands a profile in social-svc with the correct full name and picture**, regardless of what the SPA does next. Pinned by `server/tests/test_google_auth_social_fanout.py` (6 tests).

### Layer 2 — `POST /v1/social/admin/reconcile-from-mem0`

A defensive periodic reconcile. social-svc reads mem0's `/v1/state/admin/users` (every user) and `/auth/admin/users` (password users with names) and idempotently upserts every email it finds. Designed to run on a `/schedule` cron — anything the inline fan-out missed (server down at signin time, multi-host network blip, manual user injection) self-heals on the next tick.

Body: `{mem0Url, mem0AdminApiKey}`. Returns a diff report (`created`, `updated`, `skipped`, `errors`). A flaky mem0 returns an empty report rather than a 5xx so the cron keeps walking. Pinned by `services/social-svc/__tests__/reconcile-from-mem0.test.ts` (7 tests).

### Layer 3 — `GET /auth/admin/users` on mem0

For password-registered users, mem0's `auth.users` table carries the `name` field that's missing from `user_state`. New endpoint exposes `[{email, name, role, created_at, last_login_at}]` (admin-only, dual-credential gate matching `/v1/state/admin/users`). The reconcile endpoint joins this in to fill `fullName`.

Google users still rely on Layer 1 for names — the Google identity is ephemeral (session-token only), never persisted in mem0's tables.

### Combined guarantee

> Every new Google signin lands a complete profile in social-svc within milliseconds (Layer 1). If anything goes wrong, the next reconcile tick repairs it (Layer 2 + 3). If a user signed up before any of this shipped, the next time they sign in either path picks them up.

## Bug G — identity drift after session expiry + sparse stream cold-start + admin "wipe" was unclear (2026-05-04)

Three deferred items shipped together. They share a theme: the platform's "every user has a real, permanent profile" property had three thin spots.

### G.1 — Persist Google name + avatar on user_state

Pre-fix, the Google identity (name + picture) lived only in the session JWT, which expires every 7 days. Once expired, mem0 had no record — so the reconcile path could only fill `fullName` for *password-registered* users (via `/auth/admin/users`). Google users got `displayName: "Danshtr"` (title-cased handle) until they re-signed in.

Fix (mem0 PR #21): Alembic migration `009` adds nullable `display_name` + `picture_url` columns to `user_states`. `/auth/google` upserts these on every signin via a new `upsert_user_identity()` helper. `GET /v1/state/admin/users` projection returns both. Reconcile (LearnAI #128 extended) picks them up — Google users now backfill deterministically without needing to log in again.

### G.2 — Stream cold-start with follow-suggestions

When the Stream returned `[]` AND the admin hadn't enabled mock cards, the empty state was a dead "Find people on Boards" wall. Now: when the feed is empty, the Stream fetches `getBoard("global", "week")` minus `listFollowing()` and renders up to 6 follow candidates inline. Each row has a `+ Follow` button that optimistically removes the candidate after a successful follow. The mock-cards path (gated by `showDemoData`) is unchanged.

### G.3 — Admin "Reset progress" vs "Remove permanently" — clear semantics

User feedback: *"there is a 'wipe server state', but not clear what this action does."* The single button conflated two operationally distinct intents.

| Action | Endpoint | What it touches |
|---|---|---|
| **Reset progress** | `DELETE /v1/state/admin/users/{email}` | mem0 user_state row only. **Memories, social profile, follow graph stay.** |
| **Remove permanently** *(new)* | `DELETE /v1/state/admin/users/{email}/cascade` | **All four**: mem0 user_state + memories + auth.users + social-svc (profile + follows + blocks + events) |

mem0's cascade endpoint returns a structured `steps` map per store; the SPA's `AdminUsers` panel renders it in a confirmation alert so the operator sees exactly which deletes succeeded. The "Reset progress" button's tooltip + confirmation dialog were also rewritten to spell out what stays untouched and to point at "Remove permanently" as the alternative.

## Recommended next steps

1. **Schema-level pinning**: move handle generation into a single source-of-truth file shared by both packages (e.g. via a workspace package). Today the duplication is enforced by tests; tomorrow it should be a single import.
2. **Per-environment hidden-account flag** (deferred from `docs/test-personas.md`).
3. **A "mem0 ↔ social-svc reconcile" admin job** that periodically diffs the two user sets and emits a metric. Until #1 lands, drift is the enemy.
4. **mem0 admin endpoint that exposes `auth.users` (email + name)** so social-svc can backfill `fullName` for users created without it (the 6 stranded users from this audit). Today they auto-populate on next sign-in; an explicit reconcile path would close the loop deterministically.
5. **Stream empty-state polish** — surface follow-suggestions when `[]` is returned. Working as designed today (no foreign events) but the cold-start experience could nudge harder.

## See also

- [`docs/test-personas.md`](./test-personas.md) — internal QA personas + their hidden-account allowlist.
- [`services/social-svc/README.md`](../services/social-svc/README.md) — sidecar docs.
- [`docs/aha-and-network.md`](./aha-and-network.md) — active priority queue.
