# Profile enhancements — completeness, share, SEO

> _Three additive lifts on top of the existing public-profile + social MVP. No
> contract churn. No fight with the "behavioral résumé, no bio, no employer"
> principle from [`social-mvp-product.md`](./social-mvp-product.md)._

---

## Where this PR fits

The existing system (PRs #92–#105) already ships:

- A public profile route at `/u/<handle>` rendered by [`Profile.tsx`](../app/src/views/Profile.tsx).
- An immutable handle derived from Gmail (`baseHandleFromEmail`).
- An owner cockpit at `Settings → Network` ([`Network.tsx`](../app/src/views/Network.tsx)) with profile mode (Open / Closed), field-level visibility, and signals (max-N discoverable Topics).
- A field set deliberately scoped to a *behavioral* résumé: `displayName`, `pictureUrl`, `guildTier`, `streak`, `xpTotal`, `signals`, `badges`, `currentWork`, `topicMap`, `activity14d`, `signupAt`. No bio. No employer. No age.
- Static OG meta in [`index.html`](../app/index.html) — one card for the entire site.
- Owner banner action: copy share link (clipboard, no native share fallback, no toast).

This PR doesn't change any of that. It adds five things, all additive, all UI-only. Zero changes to `social/types.ts`, `social/online.ts`, `social/offline.ts`, or any backend contract.

## What ships in this PR

| # | Lift | Why |
|---|---|---|
| 1 | **"Public" / "Private" terminology in user copy** (internal `profileMode: "open" \| "closed"` enum unchanged) | "Public/Private" reads correctly to non-technical users. "Open/Closed" leaks the system model |
| 2 | **Profile completeness gauge + missing-fields list** in `Network.tsx` | Drives onboarding completion; every empty field is a drop in conversion |
| 3 | **Native share** with clipboard fallback + a toast — replaces the silent `copyShareLink` in `Profile.tsx`'s owner banner | Mobile share rate. The current implementation calls `navigator.clipboard.writeText` and gives no feedback |
| 4 | **Per-profile SEO** — sets `<title>`, OG/Twitter meta, and a `Person` JSON-LD block when an Open profile is rendered. Reverts on unmount | Crawlable shareable URLs. Static index.html OG only renders one card for the whole site |
| 5 | **"Finish your profile" nudge** in `Settings.tsx` — shows when completeness < 100, deep-links to Network | Same retention loop as (2), but on the surface most users land on |

## What's deliberately NOT in this PR

| Idea | Why not |
|---|---|
| User-picked username | Conflicts with the immutable-handle-from-Gmail design. PRD owner call. |
| Bio / employer / pronouns / location | Excluded by the social-MVP PRD principle. PRD owner call. |
| Hero / banner image | Adjacent to the "behavioral résumé" ethos. PRD owner call. |
| External links (LinkedIn / GitHub / website) | Most-requested follow-up. Needs PRD owner approval first; would extend `PublicProfile` and require social-svc backend work. |
| Skill-level chip on profile | Requires extending `PublicProfile` + social-svc contract. Worth a separate PR once we agree it belongs on the public résumé. |

## Implementation map

```
app/src/profile/                        (new module; UI-only helpers)
├── completeness.ts   profileCompletenessSlots() + score()
├── share.ts          shareProfile() — navigator.share + clipboard fallback + toast result
└── seo.ts            setProfileSeo() / clearProfileSeo() / buildPersonJsonLd()

app/src/views/Network.tsx               (edit) terminology + completeness gauge
app/src/views/Profile.tsx               (edit) terminology + native share + SEO mount
app/src/views/Settings.tsx              (edit) "Finish your profile" nudge
```

### Terminology rename

User-facing strings move from `Open` / `Closed` → `Public` / `Private`.
Tooltips, button labels, badge pills, gate copy, panic-switch help text, and the "Currently: …" line. The internal enum stays `"open" | "closed"` so the social-svc contract and on-disk localStorage shape are unchanged. No migration needed.

### Completeness scoring

Weighted sum out of 100:

| Slot | Weight | Done when |
|---|---|---|
| Profile picture | 20 | `pictureUrl` set OR Google picture present |
| Full name | 15 | `ownerPrefs.fullName` non-empty |
| Choose a profile mode | 5 | `profileMode` set (always true once loaded) |
| At least one Signal | 20 | `signals.length >= 1` |
| Show on Global Leaderboard decided | 10 | `signalsGlobal` either explicitly true or false (always true after first load — but we treat it as a *touched* gate via heuristics: if the user has at least one Signal, this counts) |
| Show full name decided | 10 | `showFullName` true OR fullName set |
| Show current work | 5 | `showCurrent` true |
| Show topic map | 5 | `showMap` true |
| Show activity | 5 | `showActivity` true |
| Show badges | 5 | `showBadges` true |

Ring + missing-list at the top of `Network`. Hide once at 100%.

### Native share

`shareProfile({ handle, displayName })` returns `"shared" | "copied" | "failed"`. If `navigator.share` exists (mobile), open the sheet. Otherwise `navigator.clipboard.writeText` and surface a toast. Drop-in replacement for the current `copyShareLink` helper.

### Per-profile SEO

`setProfileSeo({ title, description, url, imageUrl, jsonLd })` mutates `<title>`, finds-or-creates the relevant `<meta>` tags, and replaces a single `<script id="__lai_ld_profile">`. `clearProfileSeo()` reverses everything. Stashes the original `<title>` in a `data-` attribute on `<head>` once so unmounting doesn't leave a stale title behind.

Only writes for **Open** profiles where the resolved data is loaded. Closed profiles, "not found", and the Closed gate skip the SEO write — no JSON-LD leakage of restricted data.

This is the static-SPA approximation. SSR/prerender is a future rewrite that turns this helper into a no-op on the server. Modern Googlebot does execute JS, so the meta tags + JSON-LD do get picked up today.

### "Finish your profile" nudge

A tiny card at the top of Settings, rendered when `completeness < 100`. CTA → `Network`. Hidden at 100%.

## Tests

New file `app/src/__tests__/profile-extras.test.ts` (or .tsx for share-toast):

- `profileCompletenessSlots`: returns the right shape, weights sum to 100, full-state hits 100, bare state < 100.
- `shareProfile`: uses `navigator.share` when available, falls back to clipboard, returns the right tag.
- `setProfileSeo` / `clearProfileSeo`: sets and reverts title, OG meta, and JSON-LD; preserves the original title backup.
- `buildPersonJsonLd`: includes `sameAs` only when links are non-empty (forward-compat for when external links land).

Existing 560 tests must stay green.

## Done definition

- [x] This doc
- [ ] `Network.tsx` + `Profile.tsx` use Public / Private in user copy
- [ ] Completeness ring rendered at the top of Network with click-to-edit slots
- [ ] Profile owner banner uses `shareProfile` with toast
- [ ] Open profiles set SEO meta + `Person` JSON-LD on mount, revert on unmount
- [ ] Settings shows "Finish your profile" nudge when score < 100
- [ ] All new tests pass + existing tests stay green
- [ ] `npm run build` clean
- [ ] Doc cross-linked from `docs/INDEX.md`
