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

## Recommended next steps

1. **Schema-level pinning**: move handle generation into a single source-of-truth file shared by both packages (e.g. via a workspace package). Today the duplication is enforced by tests; tomorrow it should be a single import.
2. **Per-environment hidden-account flag** (deferred from `docs/test-personas.md`).
3. **A "mem0 ↔ social-svc reconcile" admin job** that periodically diffs the two user sets and emits a metric. Until #1 lands, drift is the enemy.

## See also

- [`docs/test-personas.md`](./test-personas.md) — internal QA personas + their hidden-account allowlist.
- [`services/social-svc/README.md`](../services/social-svc/README.md) — sidecar docs.
- [`docs/aha-and-network.md`](./aha-and-network.md) — active priority queue.
