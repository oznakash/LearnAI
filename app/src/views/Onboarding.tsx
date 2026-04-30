import { useMemo, useState } from "react";
import { TOPICS } from "../content";
import { usePlayer } from "../store/PlayerContext";
import { useMemory } from "../memory/MemoryContext";
import { useAdmin } from "../admin/AdminContext";
import type { AgeBand, PlayerProfile, SkillLevel, TopicId } from "../types";
import { Mascot } from "../visuals/Mascot";
import { Illustration } from "../visuals/Illustrations";

const STEPS = [
  { id: "name", label: "Hey there" },
  { id: "age", label: "Your age" },
  { id: "level", label: "Skill level" },
  { id: "interests", label: "Interests" },
  { id: "time", label: "Daily time" },
  { id: "goal", label: "Goal" },
] as const;
type StepId = (typeof STEPS)[number]["id"];

const SKILL_LEVELS: { id: SkillLevel; label: string; sub: string; emoji: string }[] = [
  { id: "starter", label: "Curious starter", sub: "Just discovering AI", emoji: "🌱" },
  { id: "explorer", label: "Hobby explorer", sub: "Tried a few APIs", emoji: "🔭" },
  { id: "builder", label: "Active builder", sub: "Shipped AI features", emoji: "🛠️" },
  { id: "architect", label: "Senior architect", sub: "Designed AI systems", emoji: "🏛️" },
  { id: "visionary", label: "Frontier visionary", sub: "Leading in AI", emoji: "🌌" },
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

export function Onboarding() {
  const { state, setProfile } = usePlayer();
  const { remember } = useMemory();
  const { config: adminCfg } = useAdmin();
  const [stepIdx, setStepIdx] = useState(0);
  const step: StepId = STEPS[stepIdx].id;

  const [name, setName] = useState(state.identity?.name ?? state.identity?.email?.split("@")[0] ?? "");
  const [ageBand, setAgeBand] = useState<AgeBand>("adult");
  const [age, setAge] = useState<number | undefined>(undefined);
  const [skill, setSkill] = useState<SkillLevel>("explorer");
  const [interests, setInterests] = useState<TopicId[]>([]);
  const [dailyMinutes, setDailyMinutes] = useState(10);
  const [goal, setGoal] = useState<string>(GOAL_PRESETS[2]);
  const [experience, setExperience] = useState("");

  const canNext = useMemo(() => {
    switch (step) {
      case "name":
        return name.trim().length > 0;
      case "age":
        return age !== undefined;
      case "level":
        return !!skill;
      case "interests":
        return interests.length >= 1;
      case "time":
        return dailyMinutes > 0;
      case "goal":
        return goal.trim().length > 0;
    }
  }, [step, name, age, skill, interests, dailyMinutes, goal]);

  const finish = () => {
    const profile: PlayerProfile = {
      name: name.trim(),
      ageBand,
      age,
      skillLevel: skill,
      interests,
      dailyMinutes,
      goal,
      experience,
      createdAt: Date.now(),
    };
    setProfile(profile);

    // Seed the memory layer with onboarding facts. Fire-and-forget;
    // failures degrade gracefully (the next session still works).
    void remember({
      text: `Goal: ${goal}`,
      category: "goal",
      metadata: { source: "onboarding" },
    });
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
      metadata: { source: "onboarding", dailyMinutes, skill },
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

  const stepLabel = STEPS[stepIdx].label;

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
                  step === "name" ? "happy" : step === "interests" ? "wow" : step === "level" ? "thinking" : "wink"
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
              {step === "level" && (
                <>
                  <h2 className="h2">Where are you on the AI builder ladder?</h2>
                  <p className="muted">Pick the closest match — we'll recalibrate as you play.</p>
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
                  <p className="muted">Pick at least one Constellation. We'll start there and suggest more later.</p>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {TOPICS.map((t) => {
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
                  <p className="muted">We'll use this to pick missions and assessments.</p>
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
