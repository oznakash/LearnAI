# LearnAI — UX of the evolving memory layer

> What the player actually sees, when, why, and how. The cognition layer (mem0)
> is the engine; this doc is the dashboard, the steering wheel, and the trust
> mechanism around it.

Sister docs:
- [`technical.md`](./technical.md) — architecture, services, wiring, offline-flag plumbing.
- [`mem0.md`](./mem0.md) — mem0 self-hosted setup, what we store, what we don't.

---

## 1. The promise to the player

> *"LearnAI gets to know you. Your progress, your goals, the things that
> click for you, the things you keep dodging — they're remembered. Over weeks,
> the path you walk is *yours*, not a default."*

Three guarantees:

1. **The memory is yours.** Your data, you can see it, you can edit it, you can wipe it.
2. **The memory is helpful, not creepy.** The system surfaces *insights you can act on*, never trivia for its own sake.
3. **You can run it without it.** The whole app works offline-mode (no backend, no memory) the same way it does today. The intelligent layer is value-add, never a tax.

## 2. New surfaces (where memory shows up)

### 2.1 Home — "Today, for you" card

The "Today's Quest" card on Home gets a third line:

> *"You said last week you wanted to ship a RAG demo. Today's Spark in 🛠️ AI Builder is one piece. ▶ Start"*

Source of that line: a recent goal-shaped memory + a topic-suitability search. We render at most one insight per session — never two — to avoid noise.

If memory is empty (cold start) or in offline mode: the card falls back to the existing "least-recently-touched topic" behavior. No sad-empty-state.

### 2.2 During play — gentle interjections

After every ~6 Sparks, the mascot ribbon appears with a memory-derived nudge:

- *"You've nailed 4 RAG questions in a row. Want to skip ahead to Level 5?"*
- *"This is the 3rd Spark you've answered confidently on safety. Worth a Boss Cell?"*
- *"You said you only have 10 min today — 2 Sparks left in this session, then we save for tomorrow."*

The interjection is **always dismissable** with one tap. Dismiss = a small "not useful right now" memory, so the system learns when the user wants quiet.

### 2.3 Recalibration — primed by memory

The "Recalibrate" flow already exists. It now starts with a personalized 1-line preamble: *"Last calibration was 2 weeks ago. Since then you've shifted toward AI Builder topics. Let me re-tune."* No new screens — just smarter defaults derived from memory.

### 2.4 The "Your Memory" tab (new)

A new player-facing tab (under Settings → "Your memory" — kept out of the main bottom nav so it doesn't compete with daily tasks). Three sections:

#### a. **What I remember about you** — the human-readable list

Each memory is shown as a card:

```
┌────────────────────────────────────────────────────┐
│ 💡  You're stronger on prompting than on safety.   │
│     learned · 2 days ago · from 3 sessions         │
│     [Edit] [Forget]                                │
└────────────────────────────────────────────────────┘
```

Filterable by: **goals** · **strengths** · **gaps** · **preferences** · **history**.

#### b. **What I'm planning for you next** — the active recommendations

Memory becomes plans. Shown as a list of *"why I'm suggesting this next"*:

```
Next up: 🛠️ AI Builder L4 — “Cost engineering”
└─ because you said: “I want to ship cheaper AI features”
   (goal saved 5 days ago)
```

Tapping "why?" expands to the linked memories. This is the **transparency switch** of the whole product — players can audit every recommendation.

#### c. **Memory controls**

- **Privacy switch:** Toggle whether mem0 is on at all (mirrors the admin offline mode for this user).
- **Export:** Download all memories as JSON.
- **Wipe:** "Delete everything LearnAI knows about me" → calls mem0 `DELETE /memories?user_id=…`. Hard delete. Confirm dialog with the count of memories about to be erased.
- **Time travel:** Memories are immutable-ish — you can edit text but the history is preserved (with a strikethrough). Useful for the educational angle.

### 2.5 Cold-start (first session)

On the very first Spark a user finishes, we explicitly seed the memory with their onboarding answers (goal, daily minutes, age band, skill level, interests). The Mascot pops a one-time card:

> *"I'll start remembering as we go. You can see it any time in **Your Memory**. You can wipe it any time."*

Tap-to-dismiss. Stored as a `system_intro_seen` memory so we never show it twice.

### 2.6 Offline mode (new player-side affordance)

If the admin disabled the memory layer (the **offline flag** is on), the player sees:

- A small badge in the top bar: *"📴 Offline mode"*
- The "Your Memory" tab shows a friendly empty state: *"Memory is off in this deployment."*
- All memory-derived nudges fall back to the heuristic recommendations (the v1 behavior).

Same behavior client-side if mem0 is configured but the server is unreachable: badge becomes *"🟡 Memory pause — couldn't reach the brain. Retrying."* Sparks queue locally and flush on reconnect.

## 3. The admin's view

A new **Memory** tab in the Admin Console:

- **Server URL + key** for the self-hosted mem0.
- **Offline mode** toggle (the global flag) with a one-line explanation.
- **Health check** button: pings mem0, shows version + memory count.
- **Per-user inspector:** type a Gmail → get the user's memories as JSON, with a "Forget all for this user" button.
- **Bulk erase** for GDPR-style "right to be forgotten" requests.
- **Daily token cap** per user (prevents runaway memory writes).

## 4. Why the user benefits — the value, in concrete terms

Without memory, LearnAI is a great curriculum. With memory, it becomes a **personal coach**. Concretely:

| Without memory | With evolving memory |
|---|---|
| The same path for every player. | The path bends toward your gaps and your goals. |
| You re-explain context every session. | "Pick up where we left off — your RAG goal." |
| Recalibration is a cold quiz. | Recalibration starts with what we already know. |
| Insights are heuristic-driven (least-touched topic). | Insights are *you-driven* ("you've been weak on safety, here's a sharp Spark"). |
| Build Cards are generic. | Build Cards reference your stack ("you mentioned you use Postgres — here's pgvector"). |
| You can't share progress. | You can ask the system to summarize *what it knows about you* — useful for self-reflection or for sharing with a mentor. |

## 5. Privacy, trust, and the ethic

Three rules we won't break:

1. **Read-write parity.** Anything we *can write* about a user, the user can *read* and *delete*. No hidden internal scoring.
2. **One-tap kill switch.** "Wipe my memory" → executes within the same session. No 30-day grace period.
3. **No social leakage.** Memories are per-user. We never surface one user's memory to another user, *including aggregated*. The cohort leaderboard uses XP only.

## 6. Edge cases handled

| Case | What happens |
|---|---|
| User signs in on a new device | mem0 retrieves memories by their Gmail. Familiar LearnAI from minute one. |
| User changes Gmail | We do not migrate memories silently. We show a one-time card: "Want to bring memories from `old@gmail.com`? Yes / No / Ask later". |
| User signs out | Local progress wipes (existing). Memories on the server are kept until the user explicitly wipes them. |
| Admin toggles offline mode on | All write paths become no-ops. Existing memories are not deleted. Toggle off → memory resumes. |
| mem0 server unreachable | Pause-mode badge. Writes queue locally for up to 30 min. Reads fall back to "no memory available — using heuristics". |
| Daily token cap exceeded for a user | Writes pause until next day. Reads keep working. Badge: *"Memory paused — check Admin → Daily token cap"*. |

## 7. Telemetry (what we measure to improve the layer)

- % of recommendations that the user **accepted vs dismissed**.
- Recommendation **dwell time** (did they read the linked memory?).
- **Memory wipe rate** — should approach 0 if the system is useful.
- **Cold-start time-to-first-personalization** (how many sessions until the first non-heuristic insight).

These metrics live in the Admin → Memory tab so we can iterate.

## 8. What we won't build into the UX (yet)

- **Cross-user memory.** Out of scope for v1.
- **Memory-fed chat.** The mascot doesn't free-text chat with the player. Insights are pre-shaped cards.
- **Audio summaries.** Future, gated by demand.

## 9. Done = these UX checks pass

- [ ] First Spark → memory seeded with onboarding facts within < 2 s.
- [ ] By the 5th session, the Home card shows at least one memory-derived suggestion.
- [ ] "Your Memory" tab loads, lists, edits, wipes — all without leaving the SPA.
- [ ] Admin "Offline mode" toggle off ↔ on works mid-session, no reload.
- [ ] mem0 unreachable → degrades gracefully with a single visible badge.
- [ ] No memory leak — wipe button removes everything in < 1 s.
- [ ] No blocking memory call on the critical path (Spark → next Spark must stay < 50 ms).
