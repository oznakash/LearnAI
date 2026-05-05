# Profiles on LearnAI — strategy + product spec

> What a profile *is* on LearnAI, the problems it solves, the growth levers it
> unlocks, and how a member uses it to be better-represented in the network.

This doc is the senior-product-leader POV on profiles. It is the contract every
PR that touches the profile surface should re-read first.

---

## 1. Why profiles exist on LearnAI

LearnAI's vision (`docs/vision.md`) is **the AI-native learning network for
builders, creators, and curious people**. Two of those three words —
*learning* and *network* — only become real when members can find each other.

A profile is the smallest atomic surface that lets one builder say to another:
*"Here's who I am, here's what I'm working on, here's how to find me."* It is
the node a follow-edge can attach to, the hover-card a feed item links out
from, the SEO surface a Google search lands on, and the trust signal that
turns "anonymous level-up notification" into "@maya is a senior architect
who's been shipping in `ai-builder` for six weeks."

**Without a profile, LearnAI is a single-player game.** With one, it's a
network. That's the bar.

---

## 2. The five jobs a profile does

A LearnAI profile is **one screen** doing five jobs at once. We have to be
deliberate about which job is in front the moment a user lands.

| # | Job | Whose problem | Surface |
|---|---|---|---|
| 1 | **Show who I am** | Self-expression. "I want to be recognized for what I'm building." | Banner + avatar + name + bio |
| 2 | **Make me findable** | Network growth. "Other people building on AI agents should be able to find me." | Topics, leaderboards, JSON-LD, OG cards |
| 3 | **Show what I'm doing** | Aha moment. "When someone clicks on me, they instantly understand my trajectory." | Current Topic + level, 14-day activity, badges, topic map |
| 4 | **Be a place I can send people** | Off-platform growth. "I want to drop my LearnAI link in a Slack / on a CV / in a Twitter bio." | `/u/<handle>` SSR page, `og:image`, share button |
| 5 | **Tell the system what I want** | Recommendation quality. "Show me Sparks about agents, not about prompt engineering." | Topics → home feed, current goal |

Jobs 3, 4, 5 used to be split across **three separate screens** (Profile,
Settings, Settings → Network). The pass-2 pattern collapses them so a member
edits and presents themselves in a single place.

---

## 3. The user's mental model

A member should be able to say each of these out loud and have it work:

- "I want to add a photo." → tap the 📷 badge on the avatar.
- "I want to update my bio." → there's a bio field on the same screen.
- "I want to be findable for `ai-builder`." → tick `ai-builder` in **Topics**.
- "I don't want to be discoverable right now." → flip Visibility to Private.
- "I want to share my profile with a friend." → tap Share.

If any of those takes more than one screen, the IA is wrong. Especially:
**editing your profile must not be a sub-page of Settings.** Settings is for
the operational surface (sign-in, API key, daily minutes, danger zone). The
profile surface is its own first-class destination, reached by tapping the
TopBar avatar.

---

## 4. The "two concepts that feel like one" trap

LearnAI used to expose **Interests** (private preference, drives the home
feed) and **Signals** (public, drives discoverability + leaderboards) as two
separate pickers on two separate screens. Each was technically distinct;
both, presented to a member, felt like duplicate work and produced a
"why am I doing this twice?" reaction.

**The fix is conceptual, not just visual.** We collapse to one user-facing
concept — **Topics** — that does both jobs:

- A Topic the member ticks is *both* on their home feed *and* discoverable.
- The cap is 5 (the existing Signals cap).
- The language is consistent: **Topics** in the editor, **Topics**
  on Boards, **Topics** in copy.
- Behind the scenes the data model keeps `interests` and `signals` so the
  recommendation system and the discoverability system don't have to
  branch — but the user only sees one decision.

The implementation detail (`state.profile.interests` ←→ `signals`) lives
under the surface and is enforced in Network.tsx's save handler. A future
refactor can collapse the storage layer too; the user-facing concept is
already collapsed.

---

## 5. Identity must be consistent

A profile is the *identity* layer. Anything that erodes consistency erodes
trust.

**Rules:**

1. **A signed-in member sees their full name** — banner, avatar tooltip,
   leaderboard rows, Profile header — wherever a name is shown. Default
   `showFullName = true` for new accounts. (Members who've explicitly opted
   to hide their last name keep their saved preference; the forward-merge in
   `OfflineSocialService.read()` preserves explicit values.)
2. **First-name-only is a deliberate privacy choice**, not the default. The
   admin's Public Profile policy can override the default for forks with
   stricter defaults.
3. **The handle is the URL**, not the name. A member never sees `@maya`
   where their name should be. If we don't have a fullName, fall back to
   the handle's *capitalised* form (`Maya`), never to the bare `@maya`
   string.
4. **Identity sync is one-way**: Google `name` / `picture` populate the
   profile if and only if the member hasn't explicitly set them. Once a
   member uploads an avatar or sets a fullName via the editor, that wins
   forever — Google can't overwrite it.

---

## 6. Growth levers a profile unlocks

A profile isn't just a vanity surface. It is the hinge that turns LearnAI
from a learning app into a network. Here are the levers we explicitly
optimise for.

### 6.1 Profile completeness as the first onboarding loop

A 100%-complete profile (photo, bio, topics, link) drops a member into the
network ready for follows, leaderboard placement, and recommendations.
Every gap in the Completeness ring is a measurable retention risk. The
ring is the *first* thing on the editor for a reason.

**KPI:** % of MAU with profile_completeness ≥ 75%. North-star adjacent.

### 6.2 Off-platform sharing — every profile is a viral surface

`/u/<handle>` is server-rendered with OG image, JSON-LD `Person`, and
`<meta property="profile:*">`. A member dropping their link into Slack or
on a CV produces a real unfurl. Every share is a top-of-funnel signal
LearnAI doesn't pay for.

**KPI:** profile_share clicks → /u/* SSR fetches with referer ≠ self.

### 6.3 Connect with LinkedIn (the import path)

> **Full strategy + two-bucket data model:** [`profile-linkedin.md`](./profile-linkedin.md).
> This section is the summary; the linked doc is the contract.

The LinkedIn link is the highest-signal external link a builder owns. The
"Connect with LinkedIn" CTA below the LinkedIn input is now a two-mode
component that **switches automatically based on whether the operator
has wired up a LinkedIn Developer App**:

- **OAuth mode** (`LINKEDIN_CLIENT_ID` set on the social-svc): real
  OIDC flow. We ask for `openid profile email` (auto-approved by
  LinkedIn). On callback we get name, photo, email, verified-email
  flag, locale. Stored in two buckets:
  - **Bucket A — visible & editable.** Name, photo, email. One-time
    grab; seeded into `ProfileRecord`. The user owns it from there.
  - **Bucket B — context & hidden.** `sub` (dedup key),
    `emailVerified`, locale, derived `emailDomain` (powers cold-start
    "people you may know"), `pictureCdnHost`, raw OIDC claims frozen
    for re-derivation. Immutable by the user; visible only via a
    "🔍 What we know about you from LinkedIn" transparency panel.
- **Intent-capture mode** (no `LINKEDIN_CLIENT_ID`): the v0 fallback
  — clicking sets a `learnai:linkedin:intent` flag so we measure how
  many builders *want* the import. Identical visuals to the v1 CTA;
  the SPA picks the mode at runtime via a config probe so the
  operator can flip the switch without an SPA redeploy.

The honest read on what LinkedIn's API actually offers in 2026:
**no connections graph, no positions, no posts.** Those APIs have been
closed for nearly a decade. We substitute for the closed connections
graph with the derived `emailDomain` field — *"3 builders from
@stripe.com are on LearnAI"* — which is the highest-value cold-start
signal we can build without enterprise-API access.

**KPIs:** intent-capture rate (mode 1) · OAuth-completion rate
(mode 2) · % of connected accounts with `emailVerified === true` ·
30-day retention delta (connected vs. non-connected cohort).

### 6.4 Topics → discoverability flywheel

Five Topics, each a leaderboard, each a feed surface, each a recommended-
follow filter. A profile that's ticked the right Topics is in the right
discovery surfaces. A profile that's ticked nothing is invisible. Topics
are the primary lever a member has on their network growth.

**KPI:** profiles_with_signals / profiles_open · followers per topic.

### 6.5 The "your work" surface

Current Topic + level, 14-day activity, topic map, badges. These together
turn a profile from *what I claim about myself* into *what I actually do*.
Outside trust signals matter more than inside ones — recruiters, founders,
and would-be collaborators all weight verifiable activity higher than bios.

**KPI:** time_on_profile when current_work !== undefined.

---

## 7. What good looks like (UX checklist)

A redesign of the profile editor passes the bar when:

- [ ] **One destination.** Tapping the TopBar avatar opens the profile editor,
      not Settings. Settings is reached from a small "⚙ Settings" link inside
      the profile editor, not the other way round.
- [ ] **Five-second photo upload.** The 📷 badge is on the avatar (not a
      separate row). Tapping it opens the crop dialog *and the action bar
      stays visible without scrolling*.
- [ ] **Cropping works.** Drag pans, slider zooms, pinch zooms on touch.
      `Save photo` (short CTA) is never blocked by the image.
- [ ] **One Topics picker.** No "Interests" + "Signals" duplication.
      Plain-language explainer: "These shape your home feed and let other
      builders find you on Topic Leaderboards."
- [ ] **Visibility last.** Public/Private + the 13 advanced toggles live at
      the bottom, behind a `<details>` for the toggles. A first-time
      member is not asked to make 14 micro-decisions before adding a photo.
- [ ] **Names are full names.** Default `showFullName = true`. A member's
      first-and-last-name renders consistently across TopBar, Profile,
      Leaderboard, Stream.
- [ ] **LinkedIn import affordance.** "Connect with LinkedIn" sits below the
      LinkedIn link input. Even before OAuth ships, intent is captured.

---

## 8. Anti-patterns we explicitly reject

- ❌ **Profile inside Settings.** Settings is a utility drawer; profile is
      identity. Don't nest them.
- ❌ **Configuration as gameplay.** A 13-checkbox "When my profile is
      Public, also show:" wall is anti-pattern. If the operator wants
      field-level visibility, hide it behind an "Advanced" disclosure.
- ❌ **Two concepts, one decision.** Interests and Signals split. Pick one
      user-facing word; let the storage layer handle the dual-write.
- ❌ **First-name-only as default.** A member signed in with their full
      name. Showing "Maya" when they signed up as "Maya Patel" feels like
      we hid something. Default to consistency.
- ❌ **Buried photo upload.** If a user has to scroll to find or use the
      crop dialog's Save button, the photo upload is broken. Constrain
      the dialog so the action bar is always above the fold.
- ❌ **Duplicative CTAs.** "Open Network settings" + "View my public
      profile" + "Edit profile" are all the same action. One CTA, one
      place.

---

## 9. Implementation map (where each piece lives)

| Concept | Storage | UI surface | Auth |
|---|---|---|---|
| Avatar / Banner | `pictureUrl` / `heroUrl` on `ProfileRecord` | `Network.tsx` editor → `ImageCropDialog` | Owner-only |
| Full name | `fullName` on `ProfileRecord`; identity-synced from Google | `Network.tsx` "About you" | Auto-populated, owner can override |
| Bio | `bio` on `ProfileRecord` | `Network.tsx` "About you" | Owner-only |
| Skill level | `skillLevel` on `ProfileRecord`; mirrors `state.profile.skillLevel` | `Network.tsx` "About you" | Owner-only |
| Location | `location` on `ProfileRecord` | `Network.tsx` "About you" | Owner-only |
| Links (LinkedIn / GH / X / Web) | `links` on `ProfileRecord` | `Network.tsx` "Your links" | Owner-only |
| Topics | `state.profile.interests` + `social.signals` (dual-write) | `Network.tsx` "Topics" | Owner-only |
| Followers / Following / Pending / Blocked | `social.followingOut` etc. | `Network.tsx` "People" | Owner-only |
| Visibility (mode + 13 toggles) | `profileMode`, `ownerPrefs.*` | `Network.tsx` bottom card | Owner-only |
| Daily minutes / API key / OAuth client / memory / sign-out / erase | `state.*`, `state.apiKey`, etc. | `Settings.tsx` | Owner-only |

---

## 10. Open product questions

These are explicit "punted to v2" calls so we don't pretend they don't exist:

- ~~LinkedIn OAuth proper.~~ **Shipped** in PR-this-session. The
  sidecar exposes `/v1/social/me/linkedin/{config,start,callback}` plus
  `GET` and `DELETE` for the identity record. Two-bucket storage
  (visible + context). Feature-flagged on `LINKEDIN_CLIENT_ID`. Full
  strategy: [`profile-linkedin.md`](./profile-linkedin.md). Operator
  setup checklist: same doc, §10.
- Profile renaming. The handle is currently immutable. We expect to ship a
  one-time rename in v2 once we're confident the impersonation surface is
  managed by the reserved-handles list + the moderation queue.
- Profile-card hover previews on Stream and Leaderboard rows. The data
  shape is already there; the affordance lands when the network gets
  dense enough that it pays for itself.
