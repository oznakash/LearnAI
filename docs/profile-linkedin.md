# LinkedIn Connect — exec POV + two-bucket data model

> Sister doc to [`profile.md`](./profile.md) §6.3. The "Connect with LinkedIn"
> button is a small UI element with an oversized strategic surface area;
> this is the contract for what it does, what it doesn't, and why the
> data model is split the way it is.

---

## TL;DR

- **What we ask for:** OIDC scopes `openid profile email`. Auto-approved by
  LinkedIn. Same shape Calendly / Notion / Figma / Vercel use.
- **What we get:** verified identity (`sub`), name, photo, email,
  email-verified flag, locale. *Not* connections, *not* posts, *not*
  positions — those APIs are closed.
- **What we store:** **two buckets.** Bucket A (visible + editable) seeds
  the user's `ProfileRecord` and they own it from there. Bucket B (context
  + hidden) is the engine for recs, suggestions, share-copy, and future
  features.
- **What we don't store:** the OAuth `access_token`. One-shot read of
  `/v2/userinfo`, snapshot, drop the token.
- **How it ships:** feature-flagged on `LINKEDIN_CLIENT_ID` env-var
  presence. When set → real OAuth. When unset → today's intent-capture
  fallback. No code redeploy needed when credentials land.

---

## 1. Why this exists

A profile on LearnAI is the identity layer of a network ([`profile.md`](./profile.md) §6).
LinkedIn Connect serves three distinct jobs in that layer:

1. **Verified identity.** A LinkedIn `sub` claim plus a verified email is
   the strongest "this is a real builder, not a bot" signal we can get
   without running our own KYC. It's the trust spine for everything
   that comes next: anti-impersonation, anti-bot, eligibility for
   "real builders only" surfaces (e.g. moderation tier, comment
   permissions).
2. **Friction killer for empty profiles.** The single biggest funnel
   leak in any social network is members who sign up and never fill
   out a profile. One LinkedIn tap gives us name + photo + email in
   five seconds.
3. **Cold-start signal source for recommendations.** We can't pull a
   user's connections (LinkedIn's API doesn't allow that any more,
   see §3 below). But we *can* pull derivable context — email domain,
   locale, verified-human flag — and use those to suggest people they
   may know, suggest topics, and tailor share copy.

This is *additive* identity, not gating identity. Google sign-in stays
the canonical login. LinkedIn is what a builder layers on once they
want to be discoverable.

**KPIs:**
- **% of editor-visiting MAU who tap Connect** (the demand signal).
- **% of connected accounts that complete profile within 24 h** (the
  friction-killer test — connected vs. non-connected cohorts).
- **% of connected accounts with `emailVerified === true`** (drives
  the future Verified-Human badge).
- **30-day retention delta**: connected vs. non-connected cohort.

---

## 2. The two-bucket data model

The most important design decision: we split LinkedIn data into two
storage buckets that have **different mutability rules and different
visibility rules**.

### Bucket A — Visible & editable ("front office")

A *one-time grab* on connect. We seed this into `ProfileRecord` and the
user owns it from there. Edit, replace, drop the photo, write a different
bio. This bucket is **mutable**, **shown in the editor**, and stops being
LinkedIn's source of truth the moment the user touches it.

Fields:

| Field | OIDC source | Mapped onto |
|---|---|---|
| `name` (full name) | `name` | `ProfileRecord.fullName` |
| `givenName` | `given_name` | offered as `displayFirst` |
| `familyName` | `family_name` | — |
| `pictureUrl` | `picture` | `ProfileRecord.pictureUrl` (offered, user accepts) |
| `email` (display) | `email` | shown in transparency panel; not auto-set on profile |

**On connect:** the user is shown an inline panel — *"We pulled your
LinkedIn name and photo. Use them as your LearnAI profile?"* — with
[Use these] [Edit first] [Skip] buttons. **Default is opt-in for
brand-new profiles** (the friction-killer scenario), opt-out for users
who already filled out a profile.

**After connect:** user can edit anything. The LinkedIn snapshot stays
on the `LinkedinIdentity` record so we can offer "Revert to LinkedIn
photo" later, but the live `ProfileRecord` is canonical.

### Bucket B — Context & relationships ("back office")

**Maximal capture** of everything we can usefully store. **Immutable by
the user**, silently powering recommendations and future features. Visible
to them only via a *transparency disclosure* on the LinkedIn card — *"🔍 What
we know about you from LinkedIn"* — required for trust (the user
already approved on LinkedIn; the disclosure is the receipt, not a
re-consent).

Fields:

| Field | Source | Used for |
|---|---|---|
| `sub` | OIDC `sub` | **The dedup key.** One LinkedIn → one LearnAI. |
| `emailVerified` | OIDC `email_verified` | Drives the future Verified-Human badge. |
| `locale` | OIDC `locale` | Future: regional spotlight surfaces, language hints. |
| `emailDomain` | derived from `email` | **Highest-value field.** Powers "people you may know via shared employer domain" — our cold-start substitute for the closed connections API. `oz@stripe.com` → `stripe.com`. |
| `pictureCdnHost` | derived from `picture` URL | Future: media policy / replication if LinkedIn rotates CDN. |
| `rawClaims` | full OIDC userinfo, frozen JSON | Source-of-truth re-derivation buffer. If we add a new derived field in v2, we don't need users to reconnect. |
| `connectedAt` | server stamp | UI affordance + audit. |
| `refreshedAt` | server stamp on each reconnect | UI affordance ("Refresh from LinkedIn"). |

**Future expansions of Bucket B (no schema migration needed thanks to
`rawClaims`):**

- `headline` / `currentEmployer` — when LinkedIn opens those scopes back
  up. Today: not available. Recorded in §3.
- `connections[]` — when (if) the connections API is reopened to small
  apps. Today: not available.
- `recentPosts[]` — for content-aware Topic suggestion. Today: not
  available.

### Why split into two buckets?

1. **Mental model match.** The user's intuition is exactly this split:
   "things I can edit" vs. "things you use to help me." Naming the
   buckets the way the user thinks about them avoids the surprise that
   kills trust ("wait, you stored *what?*").
2. **Schema clarity.** Bucket A *merges* into `ProfileRecord` — one
   canonical source of truth for display, with the LinkedIn snapshot
   cached for "revert" and "diff." Bucket B lives **only** on
   `LinkedinIdentity` — never copied into `ProfileRecord`, never
   user-editable, never confused with profile data.
3. **Future-proof.** Bucket B is the engine for everything that comes
   next (verified-human badge, employer-domain matching, smart share
   copy, eventual graph features). Designing it as a bucket from day
   one means we don't need a schema migration in 6 months when the
   first of those features ships.
4. **Privacy posture.** When a user disconnects, both buckets clear
   atomically. There's no "we forgot a column" risk because there's
   one storage record (`LinkedinIdentity`) holding both buckets.

---

## 3. The honest read on LinkedIn's API in 2026

This is the section every product team gets wrong. **The LinkedIn API
in 2026 is not the LinkedIn API of 2014.**

What's actually available to a small social-network app like LearnAI:

| What people *plan* to import | Available? | Reality |
|---|---|---|
| Sign-in (identity, name, email, photo) | ✅ Yes | "Sign In with LinkedIn using OpenID Connect." Auto-approved. **This is our v1.** |
| Headline, current job, employer | ❌ No | Was the old `r_basicprofile` / `r_liteprofile`. Killed for new apps. Requires a Talent / Sales-Navigator partnership. |
| Education, positions | ❌ No | Same story. Enterprise-only. |
| **Connections list** | ❌ **No** | The biggest planning trap. The Connections API was deprecated eight years ago. No app — Calendly, Notion, Linear, etc. — has user connections today. |
| Recent posts | ❌ No | Killed in 2018. |
| Post on user's behalf | ⚠️ Gated | `w_member_social` requires a separate review. Not needed for v1. |

Translation: **"Connect with LinkedIn" cannot mean "import your
network."** It means *verified identity + name + photo + email*. We
substitute for the closed connections graph with derived signals
(email domain, locale) — which is why Bucket B exists.

Anyone planning around connections-graph imports is planning for a
product surface that's been closed for nearly a decade. We don't.

---

## 4. The user flow, end-to-end

**Goal:** one tap from intent to "done." Two confirmation screens
(LinkedIn approval + our "Use these details?" panel). Nothing else.

```
[Profile editor on /network]
   │
   │ user taps "Connect with LinkedIn"
   ▼
[GET /v1/social/me/linkedin/start]
   │ — issues a state token (HMAC-signed, 5-min TTL,
   │    binds the LearnAI account email + nonce + expiry)
   │ — sets a same-site, http-only state cookie
   │ — 302 to https://www.linkedin.com/oauth/v2/authorization
   │      ?response_type=code
   │      &client_id=...
   │      &redirect_uri=https://learnai.cloud-claude.com/v1/social/me/linkedin/callback
   │      &scope=openid%20profile%20email
   │      &state=<state-token>
   ▼
[LinkedIn approval screen]
   │ — user sees: "LearnAI wants: Your name, email, profile photo"
   │ — taps Allow
   ▼
[GET /v1/social/me/linkedin/callback?code=...&state=...]
   │ — verify state token (HMAC + cookie + TTL + single-use)
   │ — POST /oauth/v2/accessToken (server-to-server)
   │ — GET /v2/userinfo with bearer (server-to-server)
   │ — derive Bucket B fields (emailDomain, pictureCdnHost, ...)
   │ — store.upsertLinkedinIdentity(email, identity)
   │ — drop access_token (we never persist it)
   │ — 302 → /network?linkedin=connected
   ▼
[Profile editor — banner + "Use details?" panel]
   "✓ Connected to LinkedIn — Oz Akan · oz@example.com"
   [Use LinkedIn name + photo]  [Disconnect]  [Dismiss]
   [🔍 What we know about you from LinkedIn ▾]   ← transparency disclosure
```

The user's entire experience: **tap → approve on LinkedIn → land
back on the profile page with their name and face filled in.**

---

## 5. Privacy + safety posture

The things that make Trust & Safety nod:

- **CSRF defense.** State token is HMAC-signed with `JWT_SECRET`,
  binds account email + nonce + expiry. Re-validated on callback.
  Mismatch → reject (400, no detail leak).
- **Replay defense.** State tokens are single-use. We mark consumed
  tokens in an in-memory set with TTL.
- **One-to-one mapping.** A given LinkedIn `sub` can only link to one
  LearnAI account. If `sub` is already linked elsewhere, return a
  clean error: *"That LinkedIn is already connected to another LearnAI
  profile. Disconnect it there first."* No leak of the *other*
  account's identifier.
- **Disconnect is real deletion.** `DELETE /v1/social/me/linkedin`
  removes both buckets atomically. Not a tombstone. Truly gone.
- **No silent re-fetches.** We never quietly re-query LinkedIn after
  the initial connect. If we want fresh data, the user clicks
  "Refresh from LinkedIn" and goes through OAuth again.
- **No third-party sharing.** Bucket B never leaves the social-svc DB.
  Not exposed in the public profile projection. Not visible to other
  users. Operator-only via the admin moderation tab (operator's own
  trust ledger, not a feature surface).
- **No `access_token` persistence.** OIDC userinfo is read once, the
  token is dropped. No long-lived credential to leak.
- **No `w_member_social` at connect-time.** We never request post-on-
  behalf at connect. If we ever ship a Share-to-LinkedIn feature,
  the scope is asked at the moment of share, not bundled with sign-in.

---

## 6. Phased rollout

| Phase | When | What | Status |
|---|---|---|---|
| **v0** | yesterday | Intent-capture button — measure demand for the import. | Shipped |
| **v1** | this PR | OIDC sign-in. Verified identity + name + photo + email. Two-bucket storage. Feature-flagged on `LINKEDIN_CLIENT_ID`. | This PR |
| **v2** | once v1 has volume | Verified-Human badge for `emailVerified === true` accounts. Email-domain matching ("3 builders from @stripe.com are on LearnAI"). | Pending |
| **v3** | only if user data shows demand | "Share to LinkedIn" — `w_member_social` scope, ad-hoc post (e.g. "I beat the Boss Cell on Agents 🎉"). | Pending |
| **v4** | only if LinkedIn ever opens it | Connections-graph import. Today: ❌ not possible. Don't promise it. | Blocked on LinkedIn |

---

## 7. Kill criteria

When we'd un-ship this:

- If <5% of profile editors who see the CTA tap it after 30 days →
  demote to a quieter affordance (move below the fold, behind a
  disclosure).
- If the verified-LinkedIn cohort doesn't show meaningfully higher
  30-day retention than non-verified → remove the Verified-Human
  badge (it's not earning its visual cost).
- If LinkedIn changes the OIDC product (they have before — see the
  closure list in §3) → freeze the flow, keep stored identities,
  fall back to intent-capture mode automatically.

---

## 8. What we explicitly rejected

- **"Pull the public profile URL via the user's LinkedIn handle."**
  Rejected. LinkedIn rate-limits scraping aggressively and their TOS
  forbids it. One cease-and-desist away from delisting.
- **"Use LinkedIn as primary auth."** Rejected. Google sign-in already
  works and is universal. LinkedIn-as-only-auth would lock out
  students, hobbyists, builders without a LinkedIn presence. LinkedIn
  is *additive*, not gating.
- **"Wait until we have connections-graph access."** Rejected. That's
  a 6-month enterprise-API negotiation. The OIDC-only path captures
  ~80% of the value (verified identity + auto-fill) for ~5% of the
  integration cost.
- **"Store the access_token in case we need it later."** Rejected.
  Every team that does this creates a 3-year compliance debt. Least
  privilege says: get the data, snapshot, drop the key. Reconnect to
  refresh.
- **"Ask for `w_member_social` at connect-time."** Rejected. Bundled
  scopes raise the user's "this app wants to post for me" warning at
  the worst possible moment (the connect screen). Ask for share scope
  at the moment of share, not before.

---

## 9. Implementation map

| Concept | Storage | Code | Auth |
|---|---|---|---|
| LinkedIn OAuth config (client_id, secret, redirect_uri) | env vars only | `services/social-svc/src/index.ts` reads, `app.ts` accepts via opts | Server-side only |
| State token sign / verify | HMAC of `JWT_SECRET` | `services/social-svc/src/linkedin.ts` | Server-side only |
| `LinkedinIdentity` record (Bucket A + Bucket B) | `Snapshot.linkedinIdentities[]` on `store.ts` | `services/social-svc/src/store.ts` | Server-side only; cascade on `deleteProfileCascade` |
| `/v1/social/me/linkedin/config` (public probe) | — | `app.ts` | Public; tells SPA whether OAuth is configured |
| `/v1/social/me/linkedin/start` | — | `app.ts` | Authenticated (JWT) |
| `/v1/social/me/linkedin/callback` | writes `LinkedinIdentity` | `app.ts` | State-token-authenticated (no JWT — OAuth is its own auth) |
| `GET /v1/social/me/linkedin` | reads `LinkedinIdentity` | `app.ts` | Authenticated; owner only |
| `DELETE /v1/social/me/linkedin` | clears `LinkedinIdentity` | `app.ts` | Authenticated; owner only |
| Profile-editor LinkedIn card | runtime probe + redirect | `app/src/views/Network.tsx` | Owner only |
| Post-connect "Use details?" panel | reads `GET /me/linkedin` | `app/src/views/Network.tsx` | Owner only |
| Transparency disclosure | reads `GET /me/linkedin` | `app/src/views/Network.tsx` | Owner only |

---

## 10. Operator setup checklist

**One-time, when you're ready to flip the switch:**

1. **Create a LinkedIn Developer App** at https://www.linkedin.com/developers/apps.
   - **App URL:** `https://learnai.cloud-claude.com`
   - **Privacy Policy URL:** `https://learnai.cloud-claude.com/privacy`
   - **Terms of Use URL:** `https://learnai.cloud-claude.com/terms`
   - **Auth tab → Authorized redirect URLs:** add
     `https://learnai.cloud-claude.com/v1/social/me/linkedin/callback`
     (and your dev hostname if testing locally).
   - **Products tab:** request "Sign In with LinkedIn using OpenID
     Connect." Auto-approved within minutes.
2. Copy the **Client ID** and **Client Secret** from the Auth tab.
3. Set env vars on the social-svc resource via the Cloud-Claude MCP
   (`set_env_var`):
   - `LINKEDIN_CLIENT_ID=<from LinkedIn>`
   - `LINKEDIN_CLIENT_SECRET=<from LinkedIn>`
   - `LINKEDIN_REDIRECT_URI=https://learnai.cloud-claude.com/v1/social/me/linkedin/callback`
4. Redeploy the social-svc resource (`redeploy_app`).
5. Visit `https://learnai.cloud-claude.com/network` while signed in
   and verify the "Connect with LinkedIn" button now opens LinkedIn's
   OAuth screen (not the intent-capture fallback).
6. Tap the button, complete the flow, verify `?linkedin=connected`
   lands on the editor and the "Use these details?" panel shows.

**Privacy + Terms URLs to paste into LinkedIn's submission form:**

- Privacy: `https://learnai.cloud-claude.com/privacy`
- Terms: `https://learnai.cloud-claude.com/terms`

Both are server-rendered by the social-svc sidecar (see
[`docs/legal/`](./legal/) and `services/social-svc/src/legal.ts`)
so LinkedIn's review crawler gets real HTML with the policy text,
not a JS-empty SPA shell.

The SPA needs no rebuild for any of this — it probes the config
endpoint at runtime and silently switches modes.

---

## 11. Open questions (deliberate punts)

- **"Refresh from LinkedIn" UX.** v1 ships connect + disconnect. Re-
  connect (to refresh the snapshot) works today by tapping connect
  again, but we don't surface a dedicated "Refresh" button until v2.
  Risk if punted: low — most users won't expect this in v1.
- **What happens when the LinkedIn account is deleted on their side.**
  We won't know until they reconnect (which fails). For v1, the
  staleness is acceptable — accounts go cold across the public web,
  not just here.
- **Verified-Human badge visual treatment.** v2 problem. Will land on
  `Profile.tsx` and `Stream.tsx` row, designed in `design-language.md`.

---

*Last updated: 2026-05-04. Owner: profile-page workstream.*
