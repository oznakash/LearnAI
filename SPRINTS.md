# LearnAI — Next 5 Sprints

A tight, opinionated roadmap. Each sprint is roughly **2 weeks** and ships something a real user (or admin) can touch. The throughline: **work for everyone from curious starter to deep researcher**, with **API-key holders unlocking unlimited evolving fresh content**.

> Audience tracks we serve simultaneously:
> - **Starter** — "I'm new to AI." (literacy → confidence)
> - **Builder** — "I ship AI features." (sharp daily reps)
> - **Super-active builder** — "AI is my whole job." (frontier signal + creative push)
> - **Deep researcher** — "I need depth + paper-grade rigor." (primary sources + technique)

Each sprint advances all four tracks.

---

## Sprint 1 — Admin Console + lifecycle emails (foundation for scale)

**Goal**: Operators can run LearnAI like a product. Admins can see what's happening, configure brand and feature flags, and design the lifecycle communications that bring users back.

**Status when sprint ends**: ✅ Shipped in this PR.

### Scope
- 🛠️ Full **Admin Console** with four tabs:
  - **Users** — list, search, filter, ban/unban, send template email, reset progress.
  - **Analytics** — onboarding funnel, DAU/WAU, sparks per user, topic popularity, retention table.
  - **Emails** — provider/SMTP config + lifecycle template editor with live preview.
  - **Config** — feature flags, brand, default daily minutes, admin allowlist.
- 📧 **8 default lifecycle templates** (Welcome, First Spark, Daily reminder, Streak save, Weekly digest, Re-engagement, Level up, Boss beaten).
- 🔐 **Admin gate** via Gmail allowlist with bootstrap from Settings.
- 📚 **HOW_IT_WORKS.md** + this **SPRINTS.md**.

### Definition of done
- All four admin tabs render with mocked + local data.
- Templates are editable with live preview that substitutes sample values.
- An admin can flip every feature flag from the UI.
- ≥ 33 Vitest tests passing, build green, deployed to main via PR.

### Tracks served
- Starter / Builder / Super-active / Researcher: indirectly — the operator can now run cohorts, send re-engagement, and tune the experience per audience.

---

## Sprint 2 — Audience Tracks & Adaptive Difficulty

**Goal**: Every user feels the app was built for *their* level. The same Constellation reads differently for a 10-year-old, a working PM, and a researcher — without us writing four versions of every Spark.

### Scope
- 🎚️ **Adaptive Spark rendering**: each Spark has variants/tone hints; the renderer picks the right one for the player's `(ageBand, skillLevel)`. Falls back to default when no variant is authored.
- 🧪 **A/B variant generator** (admin-side): an admin can run an existing Spark through the LLM with audience presets and review/approve the variants. Approved variants are saved into the seed JSON.
- 📈 **Adaptive Boss Cells**: difficulty bumps if a user passes their first try with a perfect score; eases if they fail twice in a row. Visible on the topic page.
- 🔍 **"Why am I seeing this?"** — every Spark gets a tiny info button explaining the adaptive choice (level, recency, audience).
- 🧠 **Recalibration auto-triggers** every 14 days or after 5 consecutive misses on a level.

### Track-specific content additions
- **Starter**: "Plain English" toggle. Forces the simplest variant of every MicroRead, more emoji, more analogies.
- **Builder**: default variant — what we ship today.
- **Super-active builder**: "Pro mode" — denser MicroReads, more Build Cards, fewer recap prompts, weekly **Frontier digest** Spark with 3 fresh Pulse cards.
- **Researcher**: "Deep mode" — extends Sparks with citations, paper links, and a "open the source" button.

### Definition of done
- A 10-year-old, an adult builder, and a researcher each play the same level and see meaningfully different copy + difficulty.
- Admin can review/approve variants in batch.
- Recalibration triggers automatically and is observable in analytics.

### Tracks served
- All four. This is the sprint where each audience starts feeling like a first-class citizen.

---

## Sprint 3 — API-Key-Powered Endless Mode (live, evolving content)

**Goal**: When a user has an API key set (Anthropic / OpenAI / Bring-your-own-OpenRouter), the content stream is **infinite, fresh, and current**. Today's news lands as today's Sparks.

### Scope
- 🔁 **Live Mode toggle** per Constellation. When ON, the next Spark is generated on demand, calibrated to the user's last 10 sessions and audience.
- 📰 **Daily Pulse** Constellation refreshed every morning: 5 Sparks built from the last 24 hours of AI news + research. Sources surfaced in-line. Citations clickable.
- 🧬 **Evolving Sparks**: fresh content is graded by the user (👍/👎 + optional "regenerate"). Top-graded Sparks are eligible to be promoted into the seed bank by an admin.
- 🔭 **Context window**: Live Mode generation prompt includes the user's recent answers and active interests so it doesn't repeat or whiff on level.
- 🛡️ **Safety rails**: every generated Spark passes a small validator (schema, length, no PII echo, no prompt-injection echo). Failed generations are retried once, then we fall back to seed.
- 💸 **Cost meter**: a small budget bar in Settings shows tokens used today + an admin-configurable per-user cap.

### What each track gets
- **Starter**: warmer language regenerator — if a Spark bounced, ask for the same idea explained "even simpler".
- **Builder**: weekly **Build Card stream** generated from the user's stack hints (stored in profile). Live Build Cards that match the actual stack you ship.
- **Super-active builder**: trends + frontier-paper digest, refreshed daily from public sources. Always-on "What changed in AI today?" Spark.
- **Researcher**: paper-anchored Sparks. Picks one paper from the last 7 days on arXiv (admin-configurable categories), generates a 90-second précis Spark plus a deep-read Build Card with the open paper link.

### Definition of done
- A user with a valid API key can play "Endless Mode" indefinitely.
- 90% of generated Sparks pass the validator on first try.
- Admins can promote graded Sparks into the seed bank via the admin Generation Playground.
- Cost meter never silently exceeds the configured cap.

### Tracks served
- All four. This is the sprint where API-key holders unlock the unlimited-learning promise.

---

## Sprint 4 — Real backend, cohort leaderboard, real email

**Goal**: Move from single-device localStorage to a real product. Real users, real cohorts, real notifications, real email.

### Scope
- ⚙️ **Backend** (we'll start with a small Node + Postgres service, deployed to Fly or Render):
  - `/auth/google` — verifies Google ID token signatures server-side.
  - `/state` — persists `PlayerState` per user.
  - `/admin/*` — gated by allowlist.
  - `/generate` — proxies AI provider calls, key never leaves the server.
- 🧑‍🤝‍🧑 **Cohorts**: invite-only Guilds. The Leaderboard becomes real (no more bots). Cohort owners get a tiny dashboard inside the Admin Console.
- 📤 **Real email send** via Resend (default) or SMTP. The Admin Emails tab becomes live.
- 🔔 **Web push notifications** for streak save and daily reminder. Per-user opt-in.
- 🔁 **Streak Freeze** — earn 1 freeze per perfect week; auto-applied if a day is missed.
- 🪪 **Public profile pages** at `/u/<handle>` with badges, mastery cores, and a shareable card.

### Track-specific
- **Starter**: a "First Week" cohort that shares the same starter pacing.
- **Builder**: cohort templates ("Indie shippers", "PM-heavy", "0→1 startups").
- **Super-active builder**: "Frontier Guild" cohort — daily live mode + leaderboards reset weekly.
- **Researcher**: paper-club cohort — weekly synced Boss Cell focused on a single paper.

### Definition of done
- Multi-device works for real users.
- A cohort owner can invite, see analytics, and send emails.
- Web push reminders are arriving on schedule.

### Tracks served
- All four. The product becomes social and persistent.

---

## Sprint 5 — Build verification, voice, and the Researcher's deep tools

**Goal**: Close the loop on Build Cards, expand the modalities, and unlock primary-source learning for researchers.

### Scope
- ✅ **Build Card verification**:
  - Optional Claude Code integration: when a user marks a Build Card as "tried", we accept a paste of the resulting code or a link to a public gist/repo.
  - A small LLM judge checks against `successCriteria` and awards bonus XP if it passes.
  - Verified Build Cards earn a special **Verified Builder** badge.
- 🎙️ **Voice mode**: listen to MicroReads + Tips, answer Quick Picks aloud (browser speech APIs). Useful on commutes, kid-friendly for non-readers.
- 📑 **Researcher pack**:
  - **arXiv ingest**: paste an arXiv ID, get a deep-read Spark plus 3 follow-up Quick Picks.
  - **Citations on every Spark** in deep mode (linked, not just text).
  - **Personal paper queue** integrated with the Tasks tab.
  - **Reading sprint** mode: 4 papers over 4 days with linked Sparks.
- 👶 **Kid pack**:
  - "Explain like I'm 8" toggle that strictly enforces vocabulary.
  - Drawing puzzles for Pattern Match (image-based).
  - Parent dashboard inside the Admin Console (per-cohort view + reading time controls).
- 🌍 **i18n scaffolding**: English first, with hooks for instant Spark translation when a key is set.

### Definition of done
- A user can paste their Claude Code result and earn verified XP.
- Voice mode works for the entire Spark loop on Chrome + Safari.
- A researcher can drag in 4 arXiv IDs and get a personalized week of Sparks.
- A parent can manage a kid's daily limit and see what they learned.

### Tracks served
- All four — each gets a flagship feature this sprint.

---

## Cross-sprint themes

- **Quality bar**: every sprint adds tests + a manual smoke checklist for the new flows.
- **Telemetry**: from sprint 4, the backend records anonymous engagement metrics powering the Admin Analytics tab.
- **Performance**: keep production JS bundle under ~300 KB gzipped. Charts and SVGs stay hand-rolled.
- **Accessibility**: keyboard support for all Spark formats by sprint 2; screen-reader labels on charts by sprint 3.
- **Content debt**: every sprint, an admin reviews 10 user-graded Sparks and promotes the best ones into seed. Compounds the canonical content quality over time.

## Beyond sprint 5 (parking lot)

- Native mobile app wrapper.
- Multiplayer Boss raids.
- Marketplace for community Constellations.
- Org-mode: paid B2B tier with SSO, SAML, billing, and tenant-isolated data.
- Verified Mastery credentials (signed certificates / NFTs / nothing — TBD).

That's the plan. Sprint 1 ships now; sprint 2 starts on merge.
