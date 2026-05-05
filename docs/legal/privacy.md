# Privacy Policy

_Last updated: 5 May 2026._

This Privacy Policy applies to **LearnAI** at
[learnai.cloud-claude.com](https://learnai.cloud-claude.com) (the
"Service"). LearnAI is an AI-native learning network for builders,
creators, and curious people. It's also fully open-source — the
codebase that handles your data is at
[github.com/oznakash/learnai](https://github.com/oznakash/learnai).
**If you don't trust our description, read the code.**

If you self-host LearnAI on your own infrastructure, this policy
**does not apply** — you become the operator and you write your own.

---

## 1. The three questions you actually want answered

### 1.1 What do you have on me?

Just what's needed to run a learning network:

- **Identity.** Your email address, your name, and (if you uploaded
  one) a profile photo. These come from your sign-in provider (Google
  by default; LinkedIn if you connect it).
- **Profile content.** Anything you write into your public profile —
  bio, location, skill level, links to your other accounts, the
  Topics you opt into.
- **Learning progress.** Which Sparks you've completed, your XP, your
  streak, your badges, the topics you've worked on. The same
  "leaderboard data" you see in the app.
- **Cognition (memory) layer.** Short notes the app derives from your
  activity ("you preferred this Spark format," "you set a 10-minute
  daily goal") that personalize your next sessions. You can read,
  edit, and delete them in **Settings → Memory**.
- **Anonymous traffic data.** Page paths, normalized referrer domain
  (e.g. `twitter.com`), and `?ref=...` source tags. **No IP, no User
  Agent, no PII.** This is for "did the LinkedIn post bring 12
  visits?" — nothing else.

If you connect LinkedIn, we additionally store what LinkedIn returns
on the OIDC `userinfo` endpoint: your LinkedIn `sub` (a stable ID),
verified-email flag, locale, and your name + photo + email. We split
that into two buckets: a "visible" bucket you can edit, and a
"context" bucket we use silently to power features like
people-you-may-know matching by email domain. Full breakdown:
[`docs/profile-linkedin.md`](https://github.com/oznakash/learnai/blob/main/docs/profile-linkedin.md).

### 1.2 What do you do with it?

- **Run the app for you.** Render your profile, track your progress,
  show you the right next Spark, surface the right people to follow.
- **Run a public profile** at `learnai.cloud-claude.com/u/<your-handle>`
  — but only fields you've chosen to make public, and only if your
  profile is set to "Public" in the editor.
- **Power the cognition layer** — short notes that make the app
  remember your preferences across sessions.
- **Aggregate for analytics.** Visit counts, leaderboards. Never
  individual user-level data shared externally.
- **That's it.** We don't sell your data. We don't show you ads. We
  don't profile you for advertisers. We don't share your data with
  data brokers.

### 1.3 How do I get rid of it?

- **Edit anything** in Settings or the profile editor — anytime.
- **Memory layer:** delete individual entries or wipe the whole
  thing in **Settings → Memory**.
- **Sign out:** clears local state.
- **Delete the account:** in **Settings**, hit "Reset progress" to
  wipe server state, or contact us at the email below to remove the
  account permanently. We honor delete requests within 30 days.
- **Disconnect LinkedIn:** the profile editor's "Disconnect" button
  truly deletes both LinkedIn buckets atomically. No tombstone.

---

## 2. Where the data lives

- **Cognition layer (memory)** — a self-hosted **mem0** instance
  running on Cloud-Claude infrastructure with a Postgres + pgvector
  database. Both run in the EU. Encrypted in transit (TLS) and at
  rest (managed by Cloud-Claude).
- **Social layer (profile, follows, leaderboards, LinkedIn
  identity)** — the `social-svc` sidecar in the same container as the
  SPA. Data lives in JSON-on-disk for the MVP; Postgres for scale-out.
- **Profile photos + banners** — `/data/uploads/<emailHash>/...` on
  the same volume; served as static files at `/i/...`.
- **Anonymous visit data** — capped in-memory ring buffer (max
  ~50 K rows), reset on each restart. Never written to a long-term
  store.

LearnAI runs entirely on Cloud-Claude. No data brokers, no
third-party analytics, no Google Analytics, no Facebook Pixel.

---

## 3. Cookies & local storage

We use:

- **Local storage (`localStorage`)** to remember your sign-in,
  your local game state, your daily-minutes goal, your preferences,
  and a one-time `learnai:linkedin:intent` flag if you've tapped
  "Connect with LinkedIn" without OAuth being configured. **No
  third-party cookies.** No tracking pixels.
- **Session JWT (Bearer header)** issued by mem0 when you sign in.
  Lifetime: short, refreshed automatically.

---

## 4. Sign-in providers

### 4.1 Google (default)

We use Google Sign-In via Google Identity Services. We receive your
email, name, and profile photo. We don't ask for additional Google
scopes.

### 4.2 LinkedIn (optional)

If you tap "Connect with LinkedIn" in the profile editor, we run an
OpenID Connect flow with LinkedIn requesting only `openid profile
email`. We **do not** request permission to post on your behalf, read
your connections, or browse your messages — those APIs are not part
of the scope set we ask for.

What we receive: name, given/family name, profile photo URL, email,
verified-email flag, locale, a stable `sub` (LinkedIn user ID).

What we do with it: we offer to set your LearnAI name + photo from
LinkedIn (one-time, opt-in), then store the rest as immutable
"context" used to power recommendations and the future verified-human
badge. **The LinkedIn access token is read once and dropped** — we
never persist it, and we cannot post on your behalf even if we
wanted to.

You can disconnect LinkedIn at any time from the profile editor. It
truly deletes both buckets.

---

## 5. Children

LearnAI supports a kid-safe profile mode (selected during onboarding).
Kid profiles are **always private**, never appear on public
leaderboards, never appear in search engines, and have stricter
content filters. We don't knowingly collect data from kids beyond the
minimum needed to run the app. Parents / guardians may email us to
have a kid's account deleted.

---

## 6. Transfers, retention, sharing

- **No third-party data brokers.** We don't share your personal data
  with anyone outside the operator team.
- **Service providers.** We use Cloud-Claude (compute, storage,
  network) and the LLM providers you configure (OpenAI, Anthropic) as
  data processors. They process data on our behalf under contractual
  privacy commitments.
- **Retention.** Active accounts: as long as you have an account.
  Deleted accounts: removed within 30 days. Anonymous traffic logs:
  rolling ring buffer (~50 K visits, weeks at most).
- **Cross-border.** Cloud-Claude infra runs in the EU. If you're
  outside the EU, your data is transferred to and stored in the EU.

---

## 7. Your rights (GDPR, CCPA, and friends)

You have the right to: **access, correct, delete, port, restrict,
or object** to our processing of your personal data. Most of these
you can do yourself in Settings. For the rest — or for anything
unclear — email us (below).

If you're in the EU, you also have the right to lodge a complaint
with your local data-protection authority.

---

## 8. Security

- TLS in transit, encrypted at rest (managed by Cloud-Claude).
- Session JWTs are short-lived, scoped, and HMAC-signed.
- LinkedIn access tokens are read once and dropped — never persisted.
- We follow standard secure-coding practices (input validation, no
  known SQL-injection / XSS / CSRF surfaces — see the audit folder
  in the repo).
- We don't claim to be unhackable. If you find a security issue,
  email us; we'll respond promptly.

---

## 9. Changes to this policy

If we change this policy materially, we'll show you a banner and ask
you to re-acknowledge. The full revision history is the git log of
[`docs/legal/privacy.md`](https://github.com/oznakash/learnai/blob/main/docs/legal/privacy.md).

---

## 10. Contact

- **Email:** oznakash@gmail.com
- **GitHub issue:** https://github.com/oznakash/learnai/issues
- **Operator:** Oz Akan, individual operator of `learnai.cloud-claude.com`
