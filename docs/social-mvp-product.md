# Social MVP — Product Requirements Document

> _What "the social network of education for AI builders" means for the next PR. Written from a product-executive perspective._
>
> Sister doc: [`social-mvp-engineering.md`](./social-mvp-engineering.md) — same scope, told from the CTO chair.
> Anchored to: [`vision.md`](./vision.md) (pillars), [`mvp.md`](./mvp.md) (today), [`roadmap.md`](./roadmap.md) (Sprint 2).

---

## 1. What "social network" actually means here

LearnAI is **not** building a generic social network. We are not Facebook with badges. We are not Stack Overflow with XP. We are not Twitter with quizzes. The vision is precise (`vision.md`):

> _"LinkedIn became the social graph of jobs by measuring who you know. LearnAI is the social network of education for the AI era — measuring **what you learned, what you built, what you taught**, and what knowledge you helped distribute."_

That single sentence pins down the social MVP. The graph we are building is the **learning-and-building graph** of the AI era. Three principles fall out of it:

1. **The unit of social value is a Spark.** Not a post, not a comment, not a like. A Spark — the bite-size lesson, build, or insight already at the heart of the product. Every social mechanic must orbit Sparks. If a feature can't trace back to Sparks (the things people learned, completed, taught, or shared), it doesn't belong in this PR.
2. **Reputation is earned, not claimed.** No bio paragraph. No "I am passionate about AI." A profile is a *behavioral résumé*: what you mastered, what you're working on, what streak you keep, what topics you're drawn to. Vision pillar §4.
3. **Social is added on top of value, not below it.** The first-week ethic from `vision.md` still holds: a player with zero followers must still feel LearnAI is the best 10 minutes of their day. The social layer is a multiplier on a product that already works alone.

The five mechanics in scope (followers, public profiles, privacy toggle, topic leaderboards, the explore feed) map onto a coherent product story:

> **A LearnAI player has a public, behavioral identity. Other players can find them, learn alongside them, see what they're working on, and follow their progress without ever leaving the bite-size Spark loop. The leaderboard is the surface where strangers become someone you might learn from. The feed is the surface where you discover what to learn next from people, not just from the algorithm.**

That is the product we are building in this PR. Everything below is in service of it.

---

## 2. Mental model: roles, surfaces, and the loop

### 2.1 Player roles in the social graph

Every signed-in player simultaneously plays four roles. The MVP supports the first three; the fourth is hinted at and unlocked in Sprint 3.

| Role | What they do | Who they are in this PR |
|---|---|---|
| **Learner** | Completes Sparks, climbs Topics | Every signed-in user. The default. |
| **Discoverer** | Browses other players, leaderboards, the feed | Every signed-in user. Gated behind privacy toggles for the people they're discovering. |
| **Public builder** | Has a profile other people can see, opts into one or more leaderboards | Every signed-in user *with `profileVisibility = public`* (default). |
| **Author** *(Sprint 3)* | Contributes Sparks, gets attribution | Out of scope for this PR. We must not block it. |

There is no admin / moderator role beyond the existing `AdminConsole` allowlist. Reports go into a queue an admin reviews — no separate moderator tool yet.

### 2.2 The four surfaces

The social MVP introduces or upgrades four user-visible surfaces. Two are net-new tabs, two are upgrades to existing screens.

| Surface | New / upgraded | Where it lives |
|---|---|---|
| **Public Profile** (`/u/<handle>`) | New | New `Profile` view, reachable from anywhere a player's name appears. |
| **Explore feed** (the *Spark Stream*) | New | New top-level tab, replacing the current 4-tab `TabBar` layout with a 5-tab one. |
| **Topic leaderboards** (the *Topic Leaderboards*) | Upgrade | Existing `Leaderboard.tsx` becomes a tabbed view: *Global* / *Per-Topic* / *Following*. |
| **Follow / privacy controls** | Upgrade | New `Settings → Network` section + a follow button on every Profile + an inline follow chip on Spark Stream cards. |

### 2.3 The social loop

```
                ┌─────────────────────────────┐
                │  You complete a Spark        │
                │  (existing core loop)        │
                └──────────────┬──────────────┘
                               │
                               ▼
                ┌─────────────────────────────┐
                │  Optional public footprint:  │
                │  • Spark count ticks up      │
                │  • Topic affinity strengthens│
                │  • Streak holds              │
                │  → if profile is public,     │
                │    others can see this       │
                └──────┬──────────────┬───────┘
                       │              │
              ┌────────▼──┐      ┌────▼────────────────┐
              │ Spark     │      │ Topic Board  │
              │ Stream    │◀─────│ (per-topic + global) │
              │ (feed)    │      │ – I appear if I      │
              │           │      │   "following" to that │
              │ – cards   │      │   topic              │
              │   from    │      └─────────┬───────────┘
              │   players │                │
              │   I       │                ▼
              │   follow │      ┌─────────────────────┐
              │   to      │      │ Player profile      │
              │           │      │ (behavioral, public)│
              └─────┬─────┘      └─────────┬───────────┘
                    │                      │
                    ▼                      ▼
              ┌─────────────────────────────┐
              │  Follow / Mute / Block /    │
              │  Report                      │
              │  (private if-they're-private │
              │   approval flow)             │
              └─────────────────────────────┘
```

The loop is asymmetric (Twitter-style follow), not bidirectional (Facebook-style friend). That is intentional and correct for a learning-and-building network.

---

## 3. Naming — the words we ship

Names matter, but plain wins. We had a richer metaphor in earlier drafts (Constellation / Tune-in / Crew / Galaxy Board) and walked it back deliberately: **for the social MVP we use the standard, familiar vocabulary that any social-platform user already knows**, layered onto the product terms that are already established (Sparks, Topics, Synapses, Guild Tiers, Boss Cells).

| Mechanic | We will call it | We will *not* call it | Why |
|---|---|---|---|
| The asymmetric follow link (verb) | **Follow** / **Unfollow** | "Tune in", "Subscribe" | Universally understood. Lower cognitive load than coined verbs for v1. We may revisit a brand-shaped verb later. |
| The set of people I follow | **Following** | "My Crew", "My Constellation" | Same. |
| The set of people who follow me | **Followers** | "Tuned-in to you", "Audience" | Same. |
| The explore feed | **Spark Stream** | "Feed", "Timeline" | "Spark" is already the unit of value in the product; "Stream" is the moving river of Sparks. The one place we keep our coined name. |
| Per-topic leaderboards | **Topic Leaderboards** (one per Topic) | "Constellation Boards" | Plain, mirrors the Topic vocabulary. |
| The single global leaderboard | **Global Leaderboard** | "Galaxy Board" | Plain. |
| The "topics I want my profile to be discoverable under" | **Signals** | "Tags", "Skills" | "Tags" is already overloaded; "Skills" is too narrow (some Topics are news, not skills). Signals = "the set of Topics I want to send a signal in" — short, evocative, no collision with anything else. |
| The privacy toggle (default public → opt-in private) | **Profile mode** with two values: *Open* and *Closed* | "Public / Private" | Closed implies an active gate (approval), Open implies discoverability. Cleaner than "private = hidden". |
| A pending follow request to a Closed profile | **Follow request** | "Signal request" | Plain English. |

> **Naming bar:** "If a 14-year-old can read it once and get it, we ship it." Follow, Unfollow, Followers, Following, Spark Stream, Topic Leaderboards, Global Leaderboard, Signals, Follow requests — all pass the test.
>
> **Why we walked back the metaphor-heavy names:** earlier drafts coined *Tune-in / Your Crew / Constellation Boards / Galaxy Board*. Two problems: (1) "Constellation" is already the user-facing word for our 12 Topics in the existing product, so reusing it for people overloads one word with two meanings; (2) coined verbs like "Tune-in" raise the cognitive cost of every button label. Plain words let the product itself be the surprising thing.

These names appear in copy, button labels, settings, and notifications. The engineering doc mirrors them in code identifiers (`follow`, `following`, `followers`, `sparkStream`, `signals`, `profileMode`).

---

## 4. The five capabilities — full product spec

Each section below has the same shape: **what**, **why**, **what the player can do**, **rules/edge cases**, **UI surface**.

### 4.1 Follow mechanics (Followers / Following + block + report)

#### What
An asymmetric directional graph: any player can **follow** to any other player whose profile is *Open*, instantly. For *Closed* profiles, tuning in creates a **Follow request** that must be approved. A player can also **mute**, **unfollow**, **block**, or **report** any other player.

#### Why
This is the connective tissue of the network. Without an asymmetric graph, there is no Spark Stream and no following-tab on the Boards. Symmetric "friend" requests would be a worse fit for a learning audience that includes 12-year-olds learning from staff engineers.

#### What the player can do

| Action | Available where | Outcome |
|---|---|---|
| **Follow** | Any Open profile, Topic Board row, Spark Stream card byline | Other player added to "Following" — instant for Open, Follow request for Closed. |
| **Unfollow** | Same surfaces, where I'm already following | Removes the link. Their Sparks stop appearing in my Stream within 24 h. |
| **Mute** | Any follow row, any Stream card | I stay following (counts unchanged), but their Sparks stop appearing in my Stream. They are not notified. |
| **Block** | Any profile, any Stream card | They cannot see my profile, cannot send me Follow requests. I cannot see theirs. Counts on both sides update. Mutual unfollow. |
| **Report** | Any profile, any Stream card | Opens a 1-click reason picker (*spam* / *harassment* / *off-topic content* / *impersonation* / *other*) + optional 280-char note. Goes to a moderation queue (admin tab — see §6.2). I'm auto-muted from them on report submission. |
| **Approve / decline Follow request** *(Closed profile only)* | Settings → Network → "Pending requests" | List view; bulk-approve and individual-deny supported. |
| **Cancel a pending Follow request** | "Following" list (pending section) | Removes the request silently from the recipient's queue. |

#### Rules and edge cases

- **Self-follow**: blocked at API + UI. A player cannot follow to themselves.
- **Cap on outbound follows**: 500 in MVP (mostly to prevent scrape-and-spam). Configurable in admin.
- **Rate limit on follow actions**: 60/min, 600/hour per player (admin-tunable). Prevents follow-spam and abuse of Follow requests.
- **Block precedence**: Block > Mute > Unfollow. Block removes any pending Follow request both ways.
- **Reports do not delete content** in MVP — they queue for admin review. Reported content stays visible to others until an admin acts. This is a deliberate trade-off in v1: we do not have automated moderation.
- **No notifications for blocks**. Blocked players see no error — your profile simply appears as if it doesn't exist. Same convention as Twitter / Bluesky.
- **Mute is one-way and silent.** Standard convention.

#### UI surfaces touched

| Where | Change |
|---|---|
| **Public Profile** (`/u/<handle>`) | Top-right action cluster: `Follow` / `Following` (toggle), kebab menu with `Mute`, `Block`, `Report`. Counts displayed: *X Topic · Y following*. |
| **Spark Stream cards** | Compact byline includes a `Follow` chip (if not yet following) and a kebab with the same actions. |
| **Topic Board rows** | Each row has a `Follow` chip on hover / tap. Row is dimmed if I've muted that player; hidden if I've blocked. |
| **Settings → Network** | New section. Lists my Following list(people I follow), my Followers list, pending Follow requests in/out, blocked list. Each row has the relevant inverse action. |
| **Top-Bar** | A small dot on the avatar when I have unread Follow requests. Tappable → Settings → Network. |

#### Out of scope (Sprint 3+)

- DMs / private messaging.
- Notifications when someone follows me (we just bump a counter and the dot).
- Group/cohort follow ("everyone in the Spanish Class fork").
- Recommendations of who to follow to.

---

### 4.2 Public Profile — the behavioral résumé

#### What
A read-only, shareable URL (`/u/<handle>`) that exposes a *behavioral* picture of a LearnAI player. No bio paragraph. No employer field. No location. Everything on the page is **derived from what they did in LearnAI** — and capped to what's safe to expose.

The handle is the part of the player's Gmail before the `@`, lowercased and disambiguated when needed (e.g. `maya`, `maya2`). The Gmail address itself is *never* shown publicly.

#### Why
This is the core artifact of the entire vision. From Sprint 2 of the roadmap: *"first shareable artifact"*. It is the seed of the future Talent Match feature. It is also the first thing a stranger will judge LearnAI by — so it must be **dignified, useful, and tasteful** at zero followers, day one.

#### What the player can do (on their own profile, if it's theirs)

- See exactly what visitors see.
- "Edit my profile" → opens Settings → Network with the Profile-mode toggle and field-level visibility controls (see §4.3).
- "Copy share link" → copies `https://<host>/u/<handle>`.
- "Open in incognito-like preview" → quick "Public preview" mode that suppresses the *me* chrome.

#### What anybody (signed-in) sees on someone else's profile

Layout, top to bottom:

1. **Header** — display name (first name only by default; toggle in §4.3 to show full name), handle (`@maya`), avatar (Google picture or initials), Guild Tier badge, current streak, total Synapses. **No email. No age. No location.**
2. **Topic map** — a visual radar / chip cloud of the Topics they've made progress in, ordered by Synapses-per-Topic. Each chip is clickable → that Topic's Leaderboard, scrolled to this player. Toggle in §4.3 to hide.
3. **Signals** — the topics this player has *opted into being discoverable for* (max 5; see §4.4). These are the topics they show up on in the Topic Leaderboards. Always visible if the player has set any.
4. **What they're working on** — current Topic + level, *if profile mode is Open and `currentWork` is enabled*. Player can hide this even when Open. Shows: *"Maya is on AI PM — Level 6 (Reframing requirements as evals)"*. **Never shows their answers, scores, or specific Sparks.**
5. **Streak + activity** — a 14-day Sparkline of activity counts (no per-Spark detail). The same widget already on Home for the player themselves. Toggle-able.
6. **Badges** — visible badges only (player can hide individual ones). Default: all visible.
7. **Footer** — handle, sign-up month (e.g. *"Joined March 2026"*), report button.

A profile in *Closed* mode shows only header + a "This profile is closed. Follow to follow their progress." card with a *Send Follow request* button. Nothing else leaks.

#### What's *intentionally* missing (the balance the user asked for)

| Field | Status | Rationale |
|---|---|---|
| Email address | Never shown | PII. Backend-only. |
| Age, age band | Never shown | PII; especially critical given we have minors. |
| Real-name surname | Hidden by default; opt-in toggle to show | First-name-only is enough for social warmth without exposing identity. |
| Phone, location, employer | Never collected, never shown | Out of scope and antithetical to the behavioral-résumé thesis. |
| Tasks list | Never shown | Personal work-in-progress; could leak intent (e.g. job-search build prompts). |
| Memory contents | Never shown | Hard rule. Memory is 1:1 with the player. |
| Specific Spark answers | Never shown | Cheating vector + privacy. |
| Spark-by-Spark history | Never shown | Same. We summarize: *level reached*, *topic affinity*. |
| API keys, OAuth client IDs | Never shown | Obvious. |
| Daily-minutes preference | Never shown | Behavioral-private. |

#### Edge cases

- **Profile of a banned user** → 404. Same as not-found.
- **Profile of a blocked-by-me user** → 404 from my session. They cannot tell I blocked them.
- **Closed profile that I've been approved to follow** → I see the full Open-style profile.
- **Handle collision** → `maya2`, `maya3`, ... auto-incremented at signup. Handle is immutable in MVP (we may allow a 1-time rename in a later sprint).
- **Brand-new profile (zero Sparks)** → header + an empty-state card: *"Maya just joined LearnAI. Their map will fill in with their first Sparks."* Still dignified.

#### UI surfaces touched

- **New view**: `views/Profile.tsx`. Routable via `?u=<handle>` URL parameter (the SPA stays SPA-shaped; `/u/<handle>` is a routing alias handled by `nginx.conf` → SPA fallback).
- **Top-Bar avatar tap menu** gains a "View my profile" entry.
- **Leaderboard rows + Stream cards + Memory tab citations** get the player name as a link to `/u/<handle>`.

---

### 4.3 Profile mode — Open vs. Closed (the privacy toggle)

#### What
A single, prominent toggle in **Settings → Network** with two values:

- **Open** *(default)* — anyone with the link can see your profile. Anyone can follow instantly.
- **Closed** — your profile is gated. Strangers see only your name + a *Send Follow request* card. They can follow only after you approve.

Below the toggle, a set of **field-level visibility checkboxes** for the player to fine-tune what their profile shows when Open:

```
[ Open ▾ ]  Profile mode

When my profile is Open, also show:
  ☑ My current Topic + level (what I'm working on)
  ☑ My Topic map (topic affinities)
  ☑ My 14-day activity sparkline
  ☑ My badges
  ☐ My full name (otherwise first-name only)
  ☑ Sign-up month
```

#### Why
Privacy is non-negotiable. The user said: *"toggle for users to allow them to be private — which means they'll need to approve followers requests."* That is exactly what *Closed* does, plus we let users be Open-but-tasteful with field-level controls.

#### Defaults — and why

| Setting | Default | Rationale |
|---|---|---|
| Profile mode | **Open** | The vision is a discoverable network. We bias to discoverability with strong opt-out. |
| `showCurrentWork` | On | The Spark Stream depends on it being on for most players to feel alive. |
| `showFullName` | **Off** | First-name-only is the safe default. Surnames are an opt-in. |
| `showActivity` | On | Shows you're alive without leaking detail. |
| `showBadges` | On | Already public-feeling. |
| `signalsAllowed` | Unlimited (within cap) | Signals are how leaderboards populate. |

For minors (`ageBand === "kid"`):

- Profile mode forced to **Closed**, not user-editable.
- Discovery of any kid profile from the Spark Stream is suppressed.
- They appear on Topic Leaderboards under a generic display name shape (*"Builder #1842"*) and not under their first name. Their handle is not exposed.
- Follow *to* a kid profile is blocked entirely from non-kid accounts in MVP. (Aggressive default; we relax it once we have a real moderation story.)

#### What the player can do

- Flip Open ↔ Closed at any time. Switching to Closed:
  - **Keeps** existing Topic + Followers links intact.
  - Cancels any pending outbound or inbound Follow requests visible to non-followers.
  - Hides the profile from search/Boards/Stream **for non-followers** within 60s.
- Approve / deny pending Follow requests. List view, bulk-approve.
- Toggle individual field visibility (the checkboxes above).
- Withdraw consent for *being on a leaderboard* even with Open profile (`signalsAllowed` toggle per-Signal — see §4.4).
- "Take me down" panic button — flips to Closed, suspends Signals, clears Stream presence in one tap.

#### Rules and edge cases

- **Approval is per-follow, not per-account.** Granted once; revocable any time via "Following to you" list.
- **Bulk-approve is allowed**, but a request can sit in the queue forever. We do not auto-expire requests in MVP.
- **A player who blocks me cannot reach me through approval.** Block > everything.
- **Settings → Network header** always shows current mode at a glance with a one-tap flip.
- **Switching to Closed does not delete history** of Sparks others may have already seen on the Stream (we don't retroactively erase). It does prevent new appearances.

#### UI surface

`Settings.tsx` gains a new `Network` section above the existing Preferences section. Layout:

```
Settings → Network
─────────────────────────────────
  Profile mode    [ Open ▾ ]   "View my public profile →"

  When Open, also show: [field-level checkboxes]

  ─────────────────────────────────
  Following (12)                   "Manage →"
  Following to you (4)              "Manage →"
  Follow requests (2 pending)      "Review →"
  Blocked (1)                       "Manage →"

  ─────────────────────────────────
  Take me down (panic switch)       [button]
```

---

### 4.4 Topic Leaderboards + Signals — leaderboards by topic

#### What

We replace the current single global `Leaderboard.tsx` with a **tabbed leaderboard view** that has three modes:

1. **Global Leaderboard** — global, all-topics. The current leaderboard, but populated with real (Open-profile, opted-in) players ranked by Synapses this week / month / all-time. Deterministic-mock fallback only when we have <10 real players in scope (the current behaviour stays as graceful degradation).
2. **Topic Leaderboards** — one per topic. Each board ranks players who have **set that topic as one of their Signals** by Synapses-in-that-topic this week / month / all-time.
3. **Following** — same Global Leaderboard, filtered to people I've following to. Empty state encourages tuning in.

#### Signals — the "topics I want to blend in to" mechanic

The user's request: *"ability for users to add certain topics they want to blend in into their content — find good names for the mechanics here."* Our answer:

> **Signals** are the topics a player opts into being discoverable for. Adding `AI PM` as a Signal means: "Show me on the AI PM Topic Board. Show me as an AI PM player on the Stream and on my profile."

Each player has up to **5 active Signals** in MVP (configurable). A new player auto-receives Signals for the top 2 Topics from their onboarding interests, but can change them at any time in Settings → Network → Signals.

#### Why
- Without Signals, every Topic Board would be cluttered with players who touched a topic once. Bad signal-to-noise.
- With Signals, Boards reward *commitment to a topic*. A staff engineer who's tuning in to AI Trends + Memory & Safety becomes findable and valuable on those two Boards instead of being lost in a global pool of 100k.
- Signals are also the **first-class input to the Spark Stream** (§4.5). You see Sparks from people in your follow graph **and** from top players on Boards you yourself signal into.

#### What the player can do

- Pick / change / drop Signals (max 5).
- See, for each Signal, "Where I rank" on that Board (week/month/all-time).
- Hide themselves from the Global Leaderboard only (`signalsAllowed.global = false`) while keeping per-Topic Signals on. Inverse: stay only on the Global Leaderboard and turn off all per-topic Signals.
- See on a Board: any player's avatar, first name, handle, current rank, Synapses in that period and Topic, and an inline `Follow` button.
- Tap any board row → that player's profile.

#### What appears on a Board

| Column | Content | Notes |
|---|---|---|
| Rank | `#1` … `#100` | Hard cap at 100 visible per period in MVP; pagination later. |
| Avatar | Google picture / initials | |
| Display name | First name | + handle on hover/tap. |
| Tier | Builder / Architect / Visionary / Founder / Singularity | Already in `tierForXP`. |
| Synapses (period) | Number | Sortable column. Default: descending. |
| Streak | 🔥 N | If still alive. |
| Follow chip | inline | Hidden if I'm already following or blocked. |

#### Rules and edge cases

- **A Closed-profile player does not appear on any Board.** Closing your profile pulls you off automatically.
- **Banned, muted-by-me, blocked-by-me players are filtered out of my view of every Board.**
- **A player without Signals shows up on the Global Leaderboard only** (if Open and Synapses > 0). Per-Topic Leaderboards require an active Signal for that topic.
- **Periods**: this week (Mon-anchored), this month (calendar), all-time. Three pills above the list.
- **Empty Board state** (real-data sparse): we keep a small deterministic mock cohort (the existing `FAKE_GUILD`) as filler, clearly labeled "Sample roster" and ranked *below* real players. This preserves the "feels alive on day one" property of the current MVP.
- **Live-ish update**: Board ranks recompute server-side on a 60-second cadence in MVP. Fine for the load.

#### UI surface

`Leaderboard.tsx` becomes a tabbed view:

```
Boards
─────────────────────────────────
[ Global ]  [ AI Foundations ]  [ AI PM ]  ...  [ Following ]
                                                    ─────
[ Week ▾ ]   [ Month ▾ ]   [ All-time ▾ ]

Rank · Avatar · Name · Tier · Synapses · 🔥 · [Follow]
```

The topic tabs are **only the player's own Signals** (so they don't see 12 tabs they don't care about); a `+` chip at the end opens a picker for any Topic. The TabBar's "Guild" entry is renamed **Boards** with the trophy icon retained.

---

### 4.5 Spark Stream — the explore feed

#### What

A new top-level tab — the **Spark Stream** — that surfaces a chronologically-blended-with-relevance feed of cards generated by what other players are doing in LearnAI. The user said: *"Feed — ability to explore different content and follow it (find another name for it, probably not follow). I like the spark name we use."*

→ **Spark Stream**. The verb is *follow*. The cards themselves are **Spark Cards** (extending the existing in-game Spark vocabulary).

#### Why

Without a Stream, the social graph is silent. With a Stream, the network compounds — a Sprint-2 unlock for the *"Day 30 Maya posts a Tip she discovered"* moment in `use-cases.md`. We deliberately keep MVP Stream content **player-action-derived**, not user-authored, so we ship a feed without yet shipping a contribution flow.

#### What goes in the Stream — the four card types

In MVP, the Stream is composed of four card types, all auto-generated from existing player events. **No user-uploaded media. No user-authored long posts.** That stays out until Sprint 3.

| Card type | Trigger | Content shown |
|---|---|---|
| **Level-up card** | A player I'm following to (or who shares ≥1 Signal with me) reaches a new level in a Topic | `🚀 @priya hit Level 7 in AI Builder`. CTA: *Try this Topic* / *Follow to Priya*. |
| **Boss-beaten card** | A player I'm following to passes a Boss Cell | `👾 @avi beat the Memory & Safety L8 Boss with 5/6`. CTA: *Try the Boss yourself when ready* / *Profile*. |
| **Streak-milestone card** | A player I'm following to crosses a streak threshold (7 / 30 / 100 days) | `🔥 @maya is on a 30-day streak`. CTA: *Follow / Profile*. |
| **Topic-spotlight card** | Algorithmic — a Topic I have a Signal in surfaces a top player I'm not yet following to | `✨ @sam is climbing AI Foundations — #3 this week. Follow?`. CTA: *Follow / Profile*. |

#### What's *not* in the Stream (yet)

- Not user-typed posts. (Sprint 3.)
- Not images / media. (User explicitly excluded.)
- Not Sparks themselves (the lessons stay inside Topics, not in the Stream).
- Not comments / replies / reactions. (Sprint 3.)
- Not from anyone with `profileMode = Closed` who hasn't followed me to themselves explicitly.

#### Ranking — kept simple in MVP

```
score = w_recency · recency        +  ← time-decayed (half-life 18 h)
        w_follow  · is_following    +  ← +1 if it's someone in my Following list
        w_signal  · signal_overlap +  ← +0.3 per shared Signal
        w_quality · streak_or_tier    ← small boost if author tier ≥ Architect
```

All weights live in `AdminConfig.tuning.streamWeights` (admin-tunable). No ML in MVP. No engagement-loop optimization. We are explicitly *not* optimizing for time-on-app — see vision §4.

#### Per-card actions

| Action | Outcome |
|---|---|
| Tap the card body | Open the player's profile. |
| Tap *Follow* (if shown) | Same as profile-follow. |
| Tap topic chip (e.g. *AI PM*) | Open that Topic. |
| Tap *Try this Topic* CTA | Open the Topic; if the player isn't already started, kick them into Level 1. |
| Kebab → *Mute author* | Stop seeing this author in Stream. Standard Twitter pattern. |
| Kebab → *Show fewer like this* | Logs a `down_vote` weight tweak, future-tense in MVP (just stored — no recompute yet). |
| Kebab → *Report* | Same flow as profile report. |

#### Edge cases

- **Empty Stream (zero follows, no Signals overlap)**: we show 5–8 Topic-spotlight cards seeded from the `FAKE_GUILD` mock. Same dignity rule as Boards.
- **Stream is one-page**: 50 cards in MVP, infinite-scroll later.
- **Refresh frequency**: pull-to-refresh on mobile, header refresh button on desktop. No live websocket in MVP.
- **No notifications.** A red dot on the Stream tab if there are >5 new cards since last visit. That's it.

#### UI surface

- New view: `views/SparkStream.tsx`.
- TabBar grows from 4 → 5 tabs: `Home` · **`Stream`** · `Tasks` · `Boards` · `Progress`. (We keep `Progress` — drop the renamed-Guild "Boards" duplicate. Settings remains in the Top-Bar avatar menu.)
- The Top-Bar gets a small `🌌 Stream` badge with the unread-cards counter.

---

## 5. Cross-cutting product decisions

These are the calls a product exec is paid to make. The engineering doc inherits them.

### 5.1 Default privacy posture: Open, but tastefully so

Default `profileMode = Open` is a deliberate choice. The vision is a *discoverable* network. We pair it with:
- First-name-only by default
- No PII fields shown ever
- Minors auto-Closed
- A single panic-switch ("Take me down")
- Field-level toggles for what Open exposes

This is the same posture LinkedIn took for free-tier profiles — public-by-default, opt-out granular.

### 5.2 No DMs, no comments, no media in MVP

These are the next-most-natural feature requests. We say no — for this PR — for three reasons:

1. **Moderation cost.** DMs / comments / images all need real moderation tooling we don't have.
2. **Vision pillar §4** — social on top of value. We don't ship social affordances that don't directly serve learning yet.
3. **Sprint discipline.** This PR is already 5 capabilities. Adding DMs would push us past one mergeable PR.

### 5.3 Block-by-default protections vs. discoverability

The tension: blocks need to actually hide the blocker, but a network that's discoverable is the whole point. Resolution:
- Blocks are absolute. Blocked players see 404 on profiles, are filtered out of all Boards/Streams the blocker sees.
- Blocks are not announced to either side (industry standard).
- The blocked player can still appear publicly to *third parties* (we don't shadow-ban globally based on individual blocks).

### 5.4 Reports are a queue, not an action

In MVP, reports do not delete content. They populate an admin moderation queue. The reporter is auto-muted. We are explicit about this so we never ship a UX that implies "report = delete" that would create a brigading vector.

### 5.5 The Stream optimizes for recency + relevance, not engagement

The ranking formula has no `clicks`, no `dwell`, no `like_count` term. Vision §4 makes this non-negotiable. Ranking is admin-tunable, *not* algorithmic-feedback-tunable in MVP.

### 5.6 Real-name vs. handle policy

- Display name: first name only by default; full-name opt-in.
- Handle (`@maya`): immutable in MVP.
- Email: never displayed.
- This matches `vision.md` ("reputation is earned, not claimed") — we want the *behavioural* footprint, not a credential paragraph.

### 5.7 Forks inherit the social layer cleanly

Per the fork ethos in `vision.md`:
- The social schema is in the engine, not in any specific topic.
- A fork (e.g. Spanish-Anya) gets its own social graph instance — no cross-fork follow.
- Naming (Follow, Spark Stream, Topic Leaderboards) is theme-able via `branding` config exactly like the rest of the app.

### 5.8 We do *not* introduce a "post" as a primitive

A post is a Sprint-3 contribution-flow primitive (PR-authored Spark). In MVP, the Stream shows *derived events*, not posts. This keeps the "social layer is a multiplier on the learning loop" property intact.

---

## 6. Where this lives in the UI — summary map

A consolidated map of every UI change in the social MVP, by file. **The engineering doc owns the *how*; this section owns the *where* and *what the user sees*.**

### 6.1 Player surfaces (touched by this PR)

| File | What changes |
|---|---|
| `app/src/App.tsx` | New views in the `View` union: `profile`, `stream`, `network`. Settings → Network sub-route. |
| `app/src/components/TabBar.tsx` | 4 → 5 tabs. New `Stream` tab between Home and Tasks. Renamed Guild → Boards. |
| `app/src/components/TopBar.tsx` | Avatar menu gains *View my profile* / *Network*. New Stream-unread dot. New Signal-request dot on avatar. |
| `app/src/views/Home.tsx` | New "On your Stream" rail (3 most-recent cards) above Discover-more. New "People you follow today" small card. |
| `app/src/views/TopicView.tsx` | New "On the {Topic} Topic Board" rail (top 5) below Sparks-per-level. |
| `app/src/views/Leaderboard.tsx` | Becomes the Boards view: tabbed (Global / per-Signal / Following), period pills, real-cohort first then mock filler. |
| `app/src/views/Settings.tsx` | New "Network" section above Preferences: Profile mode, field-level visibility, links to manage Following/Followers/Pending/Blocked, Signals picker, Take-me-down. |
| `app/src/views/Profile.tsx` | **New file.** Public profile view. |
| `app/src/views/SparkStream.tsx` | **New file.** The feed. |
| `app/src/views/Network.tsx` | **New file.** Sub-view for managing Topic / Followers / Pending / Blocked / Signals lists. |
| `app/src/visuals/Mascot.tsx` | New mood: `social` (used on empty Stream / first follow). |

### 6.2 Admin surfaces

| Tab | What changes |
|---|---|
| `AdminConfig` (existing tab) | New flags: `socialEnabled`, `streamEnabled`, `boardsEnabled`, `defaultProfileMode`, plus per-mechanic feature flags. New tunables: `streamWeights`, `signalsMaxPerUser`, `followRateLimits`. |
| `AdminUsers` (existing tab) | Each user row gains: profile mode, # follows, # their followers, # active reports, ban-from-social-only switch. |
| **New tab: `AdminModeration`** | Reports queue. Each row: who reported whom, reason, optional note, the Spark Stream card or profile snapshot they reported, *resolve* / *act* (warn / ban-from-social / global ban). Admin-only. |
| `AdminAnalytics` (existing tab) | New panels: follow graph density, Stream cards / day, Signal distribution across Topics, average Topic Board size, % profiles set to Closed. |

### 6.3 Data + auth boundary (the big new architectural fact)

The `architecture.md` already calls out that the *"social/talent-graph data goes in a separate Postgres database alongside mem0"*. This PR is the first to actually require that.

- Memories (cognitive, private, per-Gmail) → mem0 / Postgres-1. Unchanged.
- Social graph (profiles, follows, blocks, reports, Signals, Stream events) → **Postgres-2 (new)**.
- A tiny auth-verifying proxy sits in front of both, doing Google ID-token verification and per-Gmail rate-limiting (this is the Sprint-2 proxy from the existing roadmap; it lands in this PR).
- The SPA never calls Postgres-2 directly. It calls the proxy, which calls Postgres-2.

Engineering details in [`social-mvp-engineering.md`](./social-mvp-engineering.md).

---

## 7. Success metrics — how we know it worked

### 7.1 Day-of-merge bar (the green-CI gate)

- 100 % of existing 90 / 90 tests still pass.
- New tests added across at least: profile rendering, follow/out idempotence, Closed-profile gating, block precedence, report queue, Signals cap, Boards filtering, Stream ranking determinism. (Coverage owned by engineering doc.)
- `npm run build` clean, bundle delta ≤ +120 KB gzipped (target).
- All five capabilities reachable behind feature flags in `AdminConfig.flags`. Flags default ON for the live deploy, default OFF in `defaults.ts` (fork-safe — a fork inherits a non-social engine until they flip the flags).

### 7.2 Two-week post-launch read

| Metric | Target | Why this number |
|---|---|---|
| Profile view → follow conversion | ≥ 20 % | A profile is finally *useful*. |
| % active players with ≥1 follow | ≥ 35 % at week 2 | The graph is forming. |
| Stream tab DAU / Home tab DAU | ≥ 0.5 | Players are using the feed without it eating Home's attention. |
| % profiles set to Closed | 5–25 % | Healthy band. <5 % means the toggle is invisible; >25 % means defaults are wrong. |
| Reports per 1k DAU | < 5 | Above that, we ship Sprint 3 moderation tooling earlier. |
| Topic Board MAU vs. Global Leaderboard MAU | Topic > Global | Signals work — players prefer their topics. |
| Crash-free sessions on the new screens | ≥ 99.5 % | Standard. |
| Time-on-Stream (median) | We don't optimize for this | We watch it for *runaway* increases — vision-pillar §4 violation. |

### 7.3 Vision-alignment self-check

After two weeks, we do a one-page write-up answering:
1. Did adding social *increase* the median player's wow-per-minute on Sparks? (We measure via Spark-completion-rate of net-new-after-Stream-launch players vs. the pre-launch cohort.)
2. Did anyone report feeling "obligated to engage"? (Survey + qualitative.)
3. Did the cognition layer's recommendations get *better* because the Stream surfaces real builder topics? (Compare pre/post `Today, for you` accept rates.)

If any of those is a no, we revisit before Sprint 3.

---

## 8. What we explicitly punt to later sprints

Listed here so reviewers can stop asking *"shouldn't we also …"*:

| Punted to | Item |
|---|---|
| **Sprint 3** | DMs · comments / replies on Stream cards · user-authored Sparks (the contribution flow) · attribution badges · top-contributor leaderboard · richer Stream cards including Tip / Build-share. |
| **Sprint 4** | Talent Match (recruiter view) · verified Build Card completions · paid recruiter outreach · "I'm interested in roles" toggle. |
| **Sprint 5** | Voice on Stream · push notifications · DMs with media · cross-fork follow · group cohorts. |
| **Never (per vision)** | Likes / hearts / engagement-feedback ranking signals · time-on-app optimization · public Spark answers · public memory contents. |

---

## 9. Risks & mitigations

| Risk | Likelihood | Severity | Mitigation |
|---|---|---|---|
| Privacy footgun: a kid is exposed via a Stream card | Low | **Critical** | Minors forced to Closed, kid-profiles never appear in adult Streams, kid → adult follow disabled outright. |
| Spam / bot follows | Medium | High | 60/min, 600/hr rate limits. Outbound cap of 500. Captcha re-entry on suspicious bursts. Pre-shipped flags to disable follows per-account. |
| Reports flood with no admin bandwidth | Medium | High | Each Gmail capped at 20 outbound reports / day. Triage filters in `AdminModeration`. SLA: act on every report within 72 h, document in `docs/operator-checklist.md`. |
| Stream encourages *time-on-app* and we drift from the vision | Medium | High | Ranking formula admin-tunable, no engagement-feedback term, success metrics include "time-on-Stream is *not* optimized" check. |
| Postgres-2 + auth proxy adds operator complexity | High | Medium | The auth proxy is ~50 lines (per `architecture.md`). One Fly app. We add `npm run deploy:social` mirroring `deploy:mem0`. |
| Forks inherit social and forget to disable it | Low | Medium | Defaults-off in `defaults.ts`. Live deployment flips them on via `localStorage`. Fork-recipe doc gets a section. |
| Block / report bypass via a second Gmail | Medium | Medium | Acknowledged limitation. v1 documents it; v2 adds device-fingerprint heuristics. |
| Display-name impersonation (multiple "Maya"s) | High | Low | Handles are unique and immutable. Display name is non-unique by design. We never let an impersonator take a handle that's already taken. |
| Cognition-layer × social: a player's memories accidentally leak into the Stream | Low | **Critical** | Hard rule already in `technical.md` — memory contents never leave mem0. The Stream uses ProgressState events, not memories. Engineering doc enforces with type-level isolation. |

---

## 10. Mapping back to vision pillars

| Vision pillar | This MVP advances it by |
|---|---|
| §1. Cognition layer is the moat | Stream + Boards both use Signals, which become first-class memory inputs (`category: "preference"` for Signal selections, `category: "history"` for follows) — the cognition layer gets richer because of social. |
| §2. Bite-size is non-negotiable | Stream cards are 30-second cards. Profiles are scannable in 10 seconds. No long-form posts. |
| §3. Open source is the multiplier | Social schema is themable. Names live in branding. Forks get a social network for free. |
| §4. Social on top of value, never below | We did *not* ship: likes, comments, media, DMs, reactions, time-on-app metrics, engagement ranking. We only added affordances that surface what learners already do. |
| §5. Build, don't just read | Profile foregrounds *what you've built / mastered*. Boss-beaten and Level-up cards on Stream. Build Card mention is a future Stream type — punt to Sprint 3. |

---

## 11. Open questions for the eng review

These are the places we explicitly want the engineering doc to push back if something in here is unbuildable in one PR:

1. **Real-time?** We've said 60-second cadence on Boards, pull-to-refresh on Stream. Is that fine, or does the proxy need a long-poll endpoint we should plan for?
2. **Handle uniqueness on Gmail-only sign-in.** We've said handle = local-part of Gmail, with disambiguation. Engineering owns the algorithm.
3. **Stream backfill on first follow.** When a player tunes in, do we backfill the last 7 days of cards from that author? PRD says yes (it makes the empty-state smoother); flag if cost is non-trivial.
4. **`AdminModeration` scope.** Does it ship in this PR or get its own follow-up? PRD says same PR — it cannot be a TODO.
5. **Existing `FAKE_GUILD`** — keep, replace, or relegate to admin-only sample data? PRD says keep as filler.

---

## See also

- [`social-mvp-engineering.md`](./social-mvp-engineering.md) — the CTO view of the same MVP.
- [`vision.md`](./vision.md) — pillars this MVP advances.
- [`mvp.md`](./mvp.md) — the *Not yet shipped* table this PR closes 4 rows of.
- [`roadmap.md`](./roadmap.md) — Sprint 2 is what this PR is.
- [`architecture.md`](./architecture.md) §"What changes when we ship the social + Talent Match" — the structural change this PR realizes.
- [`use-cases.md`](./use-cases.md) — Maya, Avi, Priya, Daniel — they're the people we're shipping this for.
