import { useMemo, useState } from "react";
import { TOPICS, getTopic } from "../content";
import { usePlayer } from "../store/PlayerContext";
import { useMemory } from "../memory/MemoryContext";
import { useAdmin } from "../admin/AdminContext";
import {
  FLUENCY_PROBE,
  ROLE_LABEL,
  fluencyToSkill,
  probeScore,
  roleTopicOrder,
  roleToSuggestedSkill,
  roleToSuggestedTopics,
} from "../store/role";
import { nextRecommendedSpark } from "../store/game";
import type {
  AgeBand,
  Intent,
  PlayerProfile,
  PlayerState,
  Role,
  SkillLevel,
  TopicId,
} from "../types";
import { Mascot } from "../visuals/Mascot";
import { Illustration } from "../visuals/Illustrations";

const STEPS = [
  { id: "name", label: "Hey there" },
  { id: "role", label: "Your role" },
  { id: "age", label: "Your age" },
  { id: "fluency", label: "AI fluency" },
  { id: "interests", label: "Interests" },
  { id: "time", label: "Daily time" },
  { id: "goal", label: "Goal" },
  { id: "preview", label: "Your first Spark" },
] as const;
type StepId = (typeof STEPS)[number]["id"];

const SKILL_LEVELS: { id: SkillLevel; label: string; sub: string; emoji: string }[] = [
  { id: "starter", label: "Curious starter", sub: "Just discovering AI", emoji: "🌱" },
  { id: "explorer", label: "Hobby explorer", sub: "Tried a few APIs", emoji: "🔭" },
  { id: "builder", label: "Active builder", sub: "Shipped AI features", emoji: "🛠️" },
  { id: "architect", label: "Senior architect", sub: "Designed AI systems", emoji: "🏛️" },
  { id: "visionary", label: "Frontier visionary", sub: "Leading in AI", emoji: "🌌" },
];

const ROLES: Role[] = [
  "student",
  "pm",
  "engineer",
  "designer",
  "creator",
  "exec",
  "researcher",
  "curious",
  "other",
];

const TIME_OPTIONS = [
  { mins: 5, label: "Quick", emoji: "⚡" },
  { mins: 10, label: "Steady", emoji: "🚶" },
  { mins: 20, label: "Focused", emoji: "🏃" },
  { mins: 45, label: "Deep dive", emoji: "🧗" },
];

const GOAL_PRESETS = [
  "Ship my first AI feature",
  "Become an AI PM",
  "Be a sharper AI builder",
  "Stay current on AI news",
  "Learn AI as a kid / curious learner",
  "Lead an AI initiative at work",
];

/**
 * Multi-select intent chips on the goal step. The user can pick more
 * than one; downstream consumers (Level-Cleared CTA, recommender) read
 * the array. See `Intent` in `types.ts` and `docs/content-model.md` §5.
 */
const INTENT_OPTIONS: { id: Intent; label: string; emoji: string; sub: string }[] = [
  { id: "curious", emoji: "🌱", label: "Curious", sub: "I want to understand AI without coding" },
  { id: "applied", emoji: "🛠", label: "Applied", sub: "I want to ship things, fast" },
  { id: "decision", emoji: "📐", label: "Decision-maker", sub: "I want to make better calls (PM / exec / operator)" },
  { id: "researcher", emoji: "🔬", label: "Researcher", sub: "I want to track the frontier" },
  { id: "forker", emoji: "🌐", label: "Forker", sub: "I want to run my own version of this for my domain" },
];

/**
 * Best-guess display name from a Google identity. Prefers an explicit
 * `name` from the OAuth payload. Falls back to the email handle but
 * sanitizes Gmail-style tags (`+work`, `+qa`) and namespace-style
 * separators — `learnai-qa+maya@gmail.com` should pre-fill as `Maya`,
 * not `learnai-qa+maya`. If the handle is dominated by token-ish stubs
 * (`qa`, `test`, `learnai`), the field is left empty so the user types
 * their real name; the muted placeholder ("Your name") is more inviting
 * than a machine-looking string they have to delete first.
 */
export function deriveDefaultName(identity?: { name?: string; email?: string }): string {
  if (identity?.name && identity.name.trim().length > 0) return identity.name.trim();
  const email = identity?.email;
  if (!email) return "";
  const handle = email.split("@")[0];
  if (!handle) return "";
  // Tokens that look like namespace stubs rather than human names — we'd
  // rather show an empty placeholder than greet someone as "Hey QA" or
  // "Hey LearnAI." Add new tokens here as new test/scaffold patterns appear.
  const tokenish = new Set([
    "qa", "test", "dev", "prod", "ftue", "demo", "admin", "user",
    "learnai", "builderquest", "synapse", "claude", "anthropic",
  ]);
  const titleCase = (s: string) => {
    const lower = s.toLowerCase();
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  };
  const pickSegment = (text: string): string | null => {
    const segments = text
      .split(/[-._]+/)
      .filter((s) => /[a-zA-Z]/.test(s));
    if (segments.length === 0) return null;
    // Walk right→left and pick the first non-token-ish segment.
    for (let i = segments.length - 1; i >= 0; i--) {
      if (!tokenish.has(segments[i].toLowerCase())) return titleCase(segments[i]);
    }
    return null;
  };
  // Gmail tag rule. If `learnai-qa+maya`, the `+maya` suffix is more likely
  // the actual person's name than the multi-segment prefix — but only when
  // the prefix already looks like a namespace (multiple segments). A plain
  // `maya+work@gmail.com` gets the normal "drop the +tag" treatment.
  const plusIdx = handle.indexOf("+");
  if (plusIdx >= 0) {
    const beforePlus = handle.slice(0, plusIdx);
    const afterPlus = handle.slice(plusIdx + 1);
    const beforeIsNamespaced = /[-._]/.test(beforePlus);
    if (beforeIsNamespaced) {
      const afterPick = pickSegment(afterPlus);
      if (afterPick) return afterPick;
    }
    const beforePick = pickSegment(beforePlus);
    if (beforePick) return beforePick;
    // Both sides were token-ish — fall through to nothing.
    return "";
  }
  return pickSegment(handle) ?? "";
}

/**
 * Derives the topics the interests step pre-checks. Strict role-driven
 * suggestion when the user has picked one; falls back to an empty
 * pre-selection (the existing behavior) for the back-compat path where
 * the role step was skipped or the role is "other".
 */
export function defaultInterestsForRole(role: Role | undefined): TopicId[] {
  if (!role || role === "other") return [];
  return roleToSuggestedTopics(role);
}

export function Onboarding() {
  const { state, setProfile } = usePlayer();
  const { remember } = useMemory();
  const { config: adminCfg } = useAdmin();
  const [stepIdx, setStepIdx] = useState(0);
  const step: StepId = STEPS[stepIdx].id;

  const [name, setName] = useState(deriveDefaultName(state.identity));
  const [role, setRole] = useState<Role | undefined>(undefined);
  const [ageBand, setAgeBand] = useState<AgeBand>("adult");
  const [age, setAge] = useState<number | undefined>(undefined);
  const [skill, setSkill] = useState<SkillLevel>("explorer");
  /** Two parallel arrays keyed by `FLUENCY_PROBE` order. */
  const [probeAnswers, setProbeAnswers] = useState<number[]>([]);
  const [interests, setInterests] = useState<TopicId[]>([]);
  const [showAllTopics, setShowAllTopics] = useState(false);
  const [dailyMinutes, setDailyMinutes] = useState(10);
  const [goal, setGoal] = useState<string>(GOAL_PRESETS[2]);
  const [intents, setIntents] = useState<Intent[]>([]);
  const [experience, setExperience] = useState("");

  const toggleIntent = (id: Intent) =>
    setIntents((arr) => (arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]));

  // The fluency-probe yields a numeric score; the inferred skill becomes
  // the suggested skill (the user can still override on the same step).
  const fluency = probeScore(probeAnswers);
  const probeAnswered = probeAnswers.filter((a) => a !== undefined).length;
  const probeSuggestedSkill = fluencyToSkill(fluency);

  const canNext = useMemo(() => {
    switch (step) {
      case "name":
        return name.trim().length > 0;
      case "role":
        return !!role;
      case "age":
        return age !== undefined;
      case "fluency":
        // Allow proceeding once both probe questions are answered OR the
        // user has explicitly picked a skill (they can override the probe).
        return probeAnswered >= FLUENCY_PROBE.length || !!skill;
      case "interests":
        return interests.length >= 1;
      case "time":
        return dailyMinutes > 0;
      case "goal":
        return goal.trim().length > 0;
      case "preview":
        return true;
    }
  }, [step, name, role, age, probeAnswered, skill, interests, dailyMinutes, goal]);

  // The first-Spark preview is computed as soon as the user has picked
  // at least one interest. We synthesize a temporary profile + state so
  // `nextRecommendedSpark` (which is the same selector the real Play
  // view uses) returns the exact Spark we'll start with. This guarantees
  // the preview is honest — if it shows "Spark X", that's literally what
  // Play will load.
  const previewState: PlayerState | null = useMemo(() => {
    if (interests.length === 0) return null;
    return {
      ...state,
      profile: {
        name: name.trim() || "you",
        ageBand,
        age,
        skillLevel: skill,
        interests,
        dailyMinutes,
        goal,
        experience,
        intents,
        role,
        fluency,
        createdAt: Date.now(),
      },
    };
  }, [state, name, ageBand, age, skill, interests, dailyMinutes, goal, experience, intents, role, fluency]);

  const previewTopicId = interests[0] ?? roleTopicOrder(role)[0] ?? TOPICS[0]?.id;
  const previewTopic = previewTopicId ? getTopic(previewTopicId) : undefined;
  const previewSpark = previewState && previewTopicId
    ? nextRecommendedSpark(previewState, previewTopicId)
    : null;

  const finish = () => {
    const profile: PlayerProfile = {
      name: name.trim(),
      ageBand,
      age,
      skillLevel: skill,
      interests,
      dailyMinutes,
      goal,
      intents,
      role,
      fluency,
      experience,
      createdAt: Date.now(),
    };
    setProfile(profile);

    // Seed the memory layer with onboarding facts. Fire-and-forget;
    // failures degrade gracefully (the next session still works).
    void remember({
      text: `Goal: ${goal}`,
      category: "goal",
      metadata: { source: "onboarding", intents },
    });
    if (role) {
      void remember({
        text: `Role: ${ROLE_LABEL[role].label}.`,
        category: "preference",
        metadata: { source: "onboarding", kind: "role", role },
      });
    }
    if (intents.length > 0) {
      const labels = intents
        .map((id) => INTENT_OPTIONS.find((o) => o.id === id)?.label ?? id)
        .join(", ");
      // The intent record is its own memory so the recommender can find
      // it cleanly (top-k search by category="goal" + metadata.kind="intent")
      // without parsing the free-text Goal line.
      void remember({
        text: `User's intent on this platform: ${labels}.`,
        category: "goal",
        metadata: { source: "onboarding", kind: "intent", intents },
      });
    }
    if (experience.trim()) {
      void remember({
        text: `Background: ${experience.trim()}`,
        category: "preference",
        metadata: { source: "onboarding" },
      });
    }
    if (interests.length > 0) {
      const interestNames = interests
        .map((id) => TOPICS.find((t) => t.id === id)?.name)
        .filter(Boolean)
        .join(", ");
      void remember({
        text: `Picked interests at onboarding: ${interestNames}`,
        category: "preference",
        metadata: { source: "onboarding", interests },
      });
    }
    void remember({
      text: `Wants to spend ~${dailyMinutes} min/day at skill level "${skill}".`,
      category: "preference",
      metadata: { source: "onboarding", dailyMinutes, skill, fluency },
    });
  };

  const next = () => {
    if (stepIdx === STEPS.length - 1) finish();
    else setStepIdx((i) => i + 1);
  };
  const back = () => setStepIdx((i) => Math.max(0, i - 1));

  const toggleInterest = (id: TopicId) =>
    setInterests((arr) => (arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]));

  const setAgeAndBand = (n: number) => {
    setAge(n);
    if (n < 13) setAgeBand("kid");
    else if (n < 18) setAgeBand("teen");
    else setAgeBand("adult");
  };

  const pickRole = (r: Role) => {
    setRole(r);
    // Pre-fill the suggested skill (user can override on the next step)
    // and pre-check the role's suggested topics. Both are revertible —
    // the user can still untick a topic or pick a different skill.
    setSkill((cur) => (cur === "explorer" ? roleToSuggestedSkill(r) : cur));
    setInterests((cur) => (cur.length === 0 ? defaultInterestsForRole(r) : cur));
  };

  const answerProbe = (questionIdx: number, optionIdx: number) => {
    setProbeAnswers((prev) => {
      const next = [...prev];
      next[questionIdx] = optionIdx;
      return next;
    });
    // After both questions are answered, gently nudge the skill pick to
    // the probe-derived suggestion. The user can still override.
    const merged = [...probeAnswers];
    merged[questionIdx] = optionIdx;
    if (merged.filter((a) => a !== undefined).length >= FLUENCY_PROBE.length) {
      setSkill(fluencyToSkill(probeScore(merged)));
    }
  };

  const stepLabel = STEPS[stepIdx].label;

  // Topic display order for the interests step. When a role is set, the
  // role's preferred topics float to the top; the rest follow. Without
  // a role we render the seed order (back-compat).
  const orderedTopics = useMemo(() => {
    if (!role) return TOPICS;
    const order = roleTopicOrder(role);
    const head = order
      .map((id) => TOPICS.find((t) => t.id === id))
      .filter((t): t is (typeof TOPICS)[number] => !!t);
    const tail = TOPICS.filter((t) => !order.includes(t.id));
    return [...head, ...tail];
  }, [role]);
  const headCount = role ? Math.max(4, defaultInterestsForRole(role).length) : 0;
  const visibleTopics = role && !showAllTopics ? orderedTopics.slice(0, headCount) : orderedTopics;

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-10">
      <div className="max-w-3xl w-full">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div
              className="w-9 h-9 rounded-xl grid place-items-center text-white font-bold"
              style={{ background: `linear-gradient(135deg, ${adminCfg.branding.accentColor}, ${adminCfg.branding.accent2Color})` }}
            >
              {adminCfg.branding.logoEmoji}
            </div>
            <div className="font-display font-semibold text-white">{adminCfg.branding.appName}</div>
          </div>
          <div className="text-xs text-white/50">
            Step {stepIdx + 1}/{STEPS.length} · {stepLabel}
          </div>
        </div>

        <div className="progress mb-6">
          <div style={{ width: `${((stepIdx + 1) / STEPS.length) * 100}%` }} />
        </div>

        <div className="card p-6 sm:p-8 min-h-[420px]">
          <div className="grid sm:grid-cols-[140px_1fr] gap-6">
            <div className="hidden sm:block">
              <Mascot
                mood={
                  step === "name"
                    ? "happy"
                    : step === "interests"
                    ? "wow"
                    : step === "fluency"
                    ? "thinking"
                    : step === "preview"
                    ? "wow"
                    : "wink"
                }
                size={120}
              />
            </div>
            <div className="space-y-5">
              {step === "name" && (
                <>
                  <h2 className="h2">What should I call you?</h2>
                  <p className="muted">We'll use it to keep things friendly.</p>
                  <input className="input" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
                </>
              )}
              {step === "role" && (
                <>
                  <h2 className="h2">What best describes you today?</h2>
                  <p className="muted">
                    Pick the one that fits closest — we'll tune the topics, tone,
                    and starting level around it. You can change this any time.
                  </p>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {ROLES.map((r) => {
                      const meta = ROLE_LABEL[r];
                      const on = role === r;
                      return (
                        <button
                          key={r}
                          type="button"
                          aria-pressed={on}
                          onClick={() => pickRole(r)}
                          className={`text-left p-3 rounded-xl border transition ${
                            on ? "bg-accent/15 border-accent shadow-glow" : "bg-white/5 border-white/10 hover:border-white/30"
                          }`}
                        >
                          <div className="text-xl">{meta.emoji}</div>
                          <div className="font-semibold text-white">{meta.label}</div>
                          <div className="text-xs text-white/60">{meta.sub}</div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
              {step === "age" && (
                <>
                  <h2 className="h2">How old are you?</h2>
                  <p className="muted">We'll tune the language and topics for you. Kids get simpler language, more games.</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[6, 8, 10, 12, 14, 16, 18, 25, 35, 45, 55, 65].map((n) => (
                      <button
                        key={n}
                        onClick={() => setAgeAndBand(n)}
                        className={`px-3 py-3 rounded-xl border ${
                          age === n
                            ? "bg-accent/20 border-accent text-white"
                            : "bg-white/5 border-white/10 text-white/70 hover:border-white/30"
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    className="input"
                    placeholder="Or type your age"
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (!isNaN(n) && n > 0) setAgeAndBand(n);
                    }}
                  />
                  <div className="text-xs text-white/50">Detected: {ageBand}</div>
                </>
              )}
              {step === "fluency" && (
                <>
                  <h2 className="h2">Quick check — where are you with AI?</h2>
                  <p className="muted">
                    Two questions. We'd rather meet you where you are than ask
                    you to label yourself with words you may not know yet.
                  </p>
                  <div className="space-y-4">
                    {FLUENCY_PROBE.map((q, qi) => (
                      <div key={q.id}>
                        <div className="font-semibold text-white text-sm mb-2">{q.prompt}</div>
                        <div className="grid grid-cols-3 gap-2">
                          {q.options.map((opt, oi) => {
                            const on = probeAnswers[qi] === oi;
                            return (
                              <button
                                key={opt.label}
                                type="button"
                                aria-pressed={on}
                                onClick={() => answerProbe(qi, oi)}
                                className={`text-center p-3 rounded-xl border transition ${
                                  on ? "bg-accent/15 border-accent text-white" : "bg-white/5 border-white/10 text-white/80 hover:border-white/30"
                                }`}
                              >
                                <div className="text-xl">{opt.emoji}</div>
                                <div className="text-xs font-semibold mt-1">{opt.label}</div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                  {probeAnswered >= FLUENCY_PROBE.length && (
                    <div
                      className="rounded-xl border border-accent/30 bg-accent/5 p-3 text-sm text-white/80"
                      aria-label="fluency suggestion"
                    >
                      <div className="text-[11px] uppercase tracking-wider text-accent font-semibold">
                        We'll meet you here
                      </div>
                      <div className="font-semibold text-white mt-0.5">
                        {SKILL_LEVELS.find((s) => s.id === probeSuggestedSkill)?.emoji}{" "}
                        {SKILL_LEVELS.find((s) => s.id === probeSuggestedSkill)?.label}
                      </div>
                      <div className="text-xs text-white/60 mt-0.5">
                        Tap a different level below if this doesn't feel right.
                      </div>
                    </div>
                  )}
                  <div>
                    <div className="label mb-2">Override (optional)</div>
                    <div className="grid sm:grid-cols-2 gap-2">
                      {SKILL_LEVELS.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => setSkill(s.id)}
                          className={`text-left p-3 rounded-xl border transition ${
                            skill === s.id
                              ? "bg-accent/15 border-accent shadow-glow"
                              : "bg-white/5 border-white/10 hover:border-white/30"
                          }`}
                        >
                          <div className="text-xl">{s.emoji}</div>
                          <div className="font-semibold text-white">{s.label}</div>
                          <div className="text-xs text-white/60">{s.sub}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="label">Background (optional)</div>
                    <input
                      className="input"
                      placeholder="e.g. PM, software engineer, student, designer"
                      value={experience}
                      onChange={(e) => setExperience(e.target.value)}
                    />
                  </div>
                </>
              )}
              {step === "interests" && (
                <>
                  <h2 className="h2">What lights you up?</h2>
                  <p className="muted">
                    {role && role !== "other"
                      ? "We pre-checked a starting set based on your role — untick anything that doesn't fit."
                      : "Pick at least one Topic. We'll start there and suggest more later."}
                  </p>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {visibleTopics.map((t) => {
                      const on = interests.includes(t.id);
                      return (
                        <button
                          key={t.id}
                          onClick={() => toggleInterest(t.id)}
                          className={`flex items-center gap-3 p-3 rounded-xl border transition ${
                            on ? "bg-accent/15 border-accent" : "bg-white/5 border-white/10 hover:border-white/30"
                          }`}
                          style={on ? { boxShadow: `0 0 0 4px ${t.color}22` } : undefined}
                        >
                          <div className="w-10 h-10 rounded-lg grid place-items-center text-xl" style={{ background: `${t.color}22` }}>
                            {t.emoji}
                          </div>
                          <div className="text-left">
                            <div className="font-semibold text-white">{t.name}</div>
                            <div className="text-[11px] text-white/60 line-clamp-1">{t.tagline}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {role && !showAllTopics && orderedTopics.length > visibleTopics.length && (
                    <button
                      type="button"
                      className="btn-ghost text-sm"
                      onClick={() => setShowAllTopics(true)}
                    >
                      ↓ Show all {orderedTopics.length} topics
                    </button>
                  )}
                </>
              )}
              {step === "time" && (
                <>
                  <h2 className="h2">How much time today?</h2>
                  <p className="muted">Pick what feels real. You can change it any time.</p>
                  <div className="grid grid-cols-2 gap-3">
                    {TIME_OPTIONS.map((o) => (
                      <button
                        key={o.mins}
                        onClick={() => setDailyMinutes(o.mins)}
                        className={`p-4 rounded-xl border text-left ${
                          dailyMinutes === o.mins ? "bg-accent/15 border-accent" : "bg-white/5 border-white/10 hover:border-white/30"
                        }`}
                      >
                        <div className="text-2xl">{o.emoji}</div>
                        <div className="font-semibold text-white">{o.label}</div>
                        <div className="text-xs text-white/60">{o.mins} min/day</div>
                      </button>
                    ))}
                  </div>
                </>
              )}
              {step === "goal" && (
                <>
                  <h2 className="h2">What are you here for?</h2>
                  <p className="muted">Pick what fits — you can pick more than one. We use this to pick the next-step nudge after every level.</p>
                  <div>
                    <div className="label mb-2">Mode (optional, multi-select)</div>
                    <div className="grid sm:grid-cols-2 gap-2">
                      {INTENT_OPTIONS.map((o) => {
                        const on = intents.includes(o.id);
                        return (
                          <button
                            key={o.id}
                            type="button"
                            onClick={() => toggleIntent(o.id)}
                            aria-pressed={on}
                            className={`p-3 rounded-xl border text-left transition ${
                              on
                                ? "bg-accent/15 border-accent text-white"
                                : "bg-white/5 border-white/10 text-white/80 hover:border-white/30"
                            }`}
                          >
                            <div className="text-base font-semibold">
                              <span className="mr-2">{o.emoji}</span>
                              {o.label}
                            </div>
                            <div className="text-xs text-white/60 mt-0.5">{o.sub}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <div className="label mb-2">Goal — pick one or write your own</div>
                    <div className="space-y-2">
                      {GOAL_PRESETS.map((g) => (
                        <button
                          key={g}
                          onClick={() => setGoal(g)}
                          className={`block w-full text-left p-3 rounded-xl border ${
                            goal === g ? "bg-accent/15 border-accent" : "bg-white/5 border-white/10 hover:border-white/30"
                          }`}
                        >
                          {g}
                        </button>
                      ))}
                      <input
                        className="input"
                        placeholder="Or write your own goal"
                        value={GOAL_PRESETS.includes(goal) ? "" : goal}
                        onChange={(e) => setGoal(e.target.value)}
                      />
                    </div>
                  </div>
                </>
              )}
              {step === "preview" && (
                <>
                  <h2 className="h2">Here's what I picked for you, {name.split(" ")[0] || "friend"} ✨</h2>
                  <p className="muted">
                    A 1-minute Spark to start with. Tap <span className="text-white">Start</span> and
                    you'll land directly inside it.
                  </p>
                  {previewTopic && previewSpark ? (
                    <div
                      className="rounded-xl border border-accent/40 bg-accent/5 p-4 sm:p-5 space-y-3"
                      aria-label="first-spark-preview"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-12 h-12 rounded-xl grid place-items-center text-2xl"
                          style={{ background: `${previewTopic.color}22`, color: previewTopic.color }}
                        >
                          {previewTopic.emoji}
                        </div>
                        <div className="min-w-0">
                          <div className="text-[11px] uppercase tracking-wider text-accent font-semibold">
                            First Spark · {previewTopic.name}
                          </div>
                          <div className="font-display font-semibold text-white text-lg leading-tight">
                            {previewSpark.spark.title}
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <Pill emoji="🎯" label="Format" value={formatLabel(previewSpark.spark.exercise.type)} />
                        <Pill emoji="⏱" label="Time" value={`~${dailyMinutes} min`} />
                        <Pill emoji="🧭" label="Level" value={`L${levelIndexForId(previewTopicId, previewSpark.levelId)}`} />
                        <Pill emoji="🌱" label="Fluency" value={fluencyTag(fluency)} />
                      </div>
                      <div className="text-xs text-white/60">
                        We use this to keep your first 60 seconds aligned with your role
                        {role ? ` (${ROLE_LABEL[role].label.toLowerCase()})` : ""} and your AI fluency
                        — you can recalibrate any time.
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
                      We'll pick a starter Spark on Home — go on through to start.
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
          <div className="flex justify-between mt-8">
            <button className="btn-ghost" onClick={back} disabled={stepIdx === 0}>
              ← Back
            </button>
            <button className="btn-primary" onClick={next} disabled={!canNext}>
              {stepIdx === STEPS.length - 1 ? "Start" : "Next"} →
            </button>
          </div>
        </div>
      </div>
      <div className="fixed -z-10 right-[-40px] top-[40%] w-72 h-72 opacity-20">
        <Illustration k="neural" />
      </div>
    </div>
  );
}

function Pill({ emoji, label, value }: { emoji: string; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-2">
      <div className="text-[10px] uppercase tracking-wider text-white/50">
        {emoji} {label}
      </div>
      <div className="text-white font-semibold text-sm leading-tight mt-0.5">{value}</div>
    </div>
  );
}

function formatLabel(t: string): string {
  switch (t) {
    case "microread":
      return "📖 MicroRead";
    case "tip":
      return "💡 Tip";
    case "quickpick":
      return "🎯 Quick Pick";
    case "patternmatch":
      return "🔗 Pattern";
    case "fillstack":
      return "🧩 Fill the Stack";
    case "scenario":
      return "🧪 Scenario";
    case "buildcard":
      return "🛠 Build Card";
    case "boss":
      return "👾 Boss";
    case "podcastnugget":
      return "🎙 Podcast";
    case "youtubenugget":
      return "📺 Video";
    default:
      return t;
  }
}

function levelIndexForId(topicId: TopicId | undefined, levelId: string): number {
  if (!topicId) return 1;
  const topic = TOPICS.find((t) => t.id === topicId);
  const lvl = topic?.levels.find((l) => l.id === levelId);
  return lvl?.index ?? 1;
}

function fluencyTag(f: number): string {
  if (f >= 4) return "Strong";
  if (f >= 3) return "Solid";
  if (f >= 1) return "Some";
  return "Fresh";
}
