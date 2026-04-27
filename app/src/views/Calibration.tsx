import { useMemo, useState } from "react";
import { TOPICS } from "../content";
import { usePlayer } from "../store/PlayerContext";
import type { TopicId, SkillLevel } from "../types";
import { Mascot } from "../visuals/Mascot";
import { Confetti } from "../visuals/Confetti";

interface Q {
  prompt: string;
  options: string[];
  answer: number;
  level: SkillLevel;
  topic: TopicId;
}

const POOL: Q[] = [
  {
    prompt: "Pick the best definition of an embedding.",
    options: [
      "A short prompt for an LLM",
      "A vector that represents meaning so similar things land near each other",
      "A small fine-tuned model",
      "A type of UI component",
    ],
    answer: 1,
    level: "explorer",
    topic: "ai-foundations",
  },
  {
    prompt: "Most cost-effective way to make repeated system prompts cheaper?",
    options: ["Bigger model", "Prompt caching", "Smaller context", "Higher temperature"],
    answer: 1,
    level: "builder",
    topic: "ai-builder",
  },
  {
    prompt: "What is the #1 LLM security category to defend against?",
    options: ["Memory leaks", "Prompt injection", "Slow GPUs", "Empty caches"],
    answer: 1,
    level: "builder",
    topic: "memory-safety",
  },
  {
    prompt: "Which model fits a real-time chat best?",
    options: ["Heavy reasoning model", "Small fast model (Haiku-class)", "Image gen", "Diffusion"],
    answer: 1,
    level: "explorer",
    topic: "llms-cognition",
  },
  {
    prompt: "Best PM artifact for AI features?",
    options: ["Press release", "Eval set", "Pitch deck", "OKR doc"],
    answer: 1,
    level: "builder",
    topic: "ai-pm",
  },
  {
    prompt: "What does an LLM literally output?",
    options: ["A finished answer", "One token at a time", "An embedding", "A summary"],
    answer: 1,
    level: "starter",
    topic: "llms-cognition",
  },
  {
    prompt: "Default vector store for an existing Postgres app?",
    options: ["Cassandra", "pgvector", "Redis", "CSV file"],
    answer: 1,
    level: "builder",
    topic: "open-source",
  },
  {
    prompt: "Why does a model hallucinate?",
    options: ["GPU error", "Gaps or noise in training data + always must predict", "Cosmic rays", "Bad internet"],
    answer: 1,
    level: "explorer",
    topic: "ai-foundations",
  },
];

const INTEREST_PROMPTS = TOPICS.map((t) => ({ id: t.id, label: `${t.emoji} ${t.name}` }));

export function Calibration({ onDone }: { onDone: () => void }) {
  const { state, setProfile } = usePlayer();
  const [stage, setStage] = useState<"intro" | "quiz" | "interests" | "result">("intro");
  const [picks, setPicks] = useState<(number | null)[]>([null, null, null, null, null]);
  const quiz = useMemo(() => POOL.slice().sort(() => Math.random() - 0.5).slice(0, 5), []);
  const [interests, setInterests] = useState<TopicId[]>(state.profile?.interests ?? []);
  const [confetti, setConfetti] = useState(0);

  const correct = quiz.reduce((acc, q, i) => acc + (picks[i] === q.answer ? 1 : 0), 0);
  const suggested: SkillLevel = correct >= 4 ? "architect" : correct >= 3 ? "builder" : correct >= 2 ? "explorer" : "starter";

  const finish = () => {
    if (state.profile) {
      setProfile({
        ...state.profile,
        skillLevel: suggested,
        interests: interests.length > 0 ? interests : state.profile.interests,
      });
    }
    setConfetti((n) => n + 1);
    setTimeout(onDone, 900);
  };

  if (stage === "intro") {
    return (
      <div className="card p-6 sm:p-8 max-w-xl mx-auto text-center space-y-3">
        <Mascot mood="thinking" size={120} />
        <h1 className="h1">Quick check-in</h1>
        <p className="muted">5 short questions + a 1-minute interest check. Helps me pick what to teach you next.</p>
        <button className="btn-primary" onClick={() => setStage("quiz")}>Let's go</button>
      </div>
    );
  }

  if (stage === "quiz") {
    return (
      <div className="space-y-4">
        <header className="flex items-center justify-between">
          <h1 className="h2">Calibration · 5 questions</h1>
          <div className="text-xs text-white/50">Score: {correct}/{picks.filter((p) => p !== null).length}</div>
        </header>
        {quiz.map((q, i) => (
          <div key={i} className="card p-4">
            <div className="text-xs text-white/50">Q{i + 1}</div>
            <div className="font-semibold text-white">{q.prompt}</div>
            <div className="space-y-2 mt-2">
              {q.options.map((o, oi) => {
                const picked = picks[i] === oi;
                const ok = picks[i] !== null && oi === q.answer;
                const wrong = picks[i] !== null && picked && oi !== q.answer;
                return (
                  <button
                    key={oi}
                    onClick={() => {
                      if (picks[i] !== null) return;
                      setPicks((p) => p.map((x, j) => (i === j ? oi : x)));
                    }}
                    className={`w-full text-left px-3 py-2 rounded-xl border ${
                      picks[i] === null
                        ? "bg-white/5 border-white/10 hover:border-white/30"
                        : ok
                        ? "bg-good/15 border-good"
                        : wrong
                        ? "bg-bad/15 border-bad"
                        : "bg-white/5 border-white/10 opacity-60"
                    }`}
                  >
                    {o}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        <button className="btn-primary" disabled={picks.some((p) => p === null)} onClick={() => setStage("interests")}>
          Continue →
        </button>
      </div>
    );
  }

  if (stage === "interests") {
    return (
      <div className="space-y-4">
        <h1 className="h2">What's on your mind right now?</h1>
        <p className="muted text-sm">Pick the topics you want more of this week. We'll feature them on Home.</p>
        <div className="grid sm:grid-cols-2 gap-2">
          {INTEREST_PROMPTS.map((it) => {
            const on = interests.includes(it.id);
            return (
              <button
                key={it.id}
                onClick={() =>
                  setInterests((arr) => (arr.includes(it.id) ? arr.filter((x) => x !== it.id) : [...arr, it.id]))
                }
                className={`p-3 rounded-xl border text-left ${on ? "bg-accent/15 border-accent" : "bg-white/5 border-white/10 hover:border-white/30"}`}
              >
                {it.label}
              </button>
            );
          })}
        </div>
        <button className="btn-primary" onClick={() => setStage("result")}>Show me my level →</button>
      </div>
    );
  }

  return (
    <div className="card p-6 sm:p-8 max-w-xl mx-auto text-center space-y-3">
      <Confetti trigger={confetti} />
      <Mascot mood="happy" size={120} />
      <h1 className="h1">You're at: {suggested.toUpperCase()}</h1>
      <p className="muted">{correct}/5 correct. We'll line up your next Sparks for this level.</p>
      <button className="btn-primary" onClick={finish}>Apply &amp; continue</button>
    </div>
  );
}
