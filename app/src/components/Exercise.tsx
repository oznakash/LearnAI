import { useMemo, useState } from "react";
import type { Exercise, VisualKey } from "../types";
import { Illustration } from "../visuals/Illustrations";

interface Props {
  exercise: Exercise;
  title: string;
  topicVisual?: VisualKey;
  /** True once this Spark has been answered; the renderer disables further input. */
  locked?: boolean;
  onAnswer: (correct: boolean, explain?: string) => void;
}

export function ExerciseRenderer({ exercise, title, topicVisual, locked, onAnswer }: Props) {
  switch (exercise.type) {
    case "microread":
      return <MicroReadView ex={exercise} title={title} topicVisual={topicVisual} locked={locked} onAnswer={onAnswer} />;
    case "tip":
      return <TipView ex={exercise} title={title} locked={locked} onAnswer={onAnswer} />;
    case "quickpick":
      return <QuickPickView ex={exercise} title={title} locked={locked} onAnswer={onAnswer} />;
    case "fillstack":
      return <FillStackView ex={exercise} title={title} locked={locked} onAnswer={onAnswer} />;
    case "scenario":
      return <ScenarioView ex={exercise} title={title} locked={locked} onAnswer={onAnswer} />;
    case "patternmatch":
      return <PatternMatchView ex={exercise} title={title} locked={locked} onAnswer={onAnswer} />;
    case "buildcard":
      return <BuildCardView ex={exercise} title={title} locked={locked} onAnswer={onAnswer} />;
    case "boss":
      return <BossView ex={exercise} title={title} onAnswer={onAnswer} />;
    case "podcastnugget":
      return <PodcastNuggetView ex={exercise} title={title} locked={locked} onAnswer={onAnswer} />;
  }
}

function MicroReadView({
  ex,
  title,
  topicVisual,
  locked,
  onAnswer,
}: {
  ex: Extract<Exercise, { type: "microread" }>;
  title: string;
  topicVisual?: VisualKey;
  locked?: boolean;
  onAnswer: (correct: boolean, explain?: string) => void;
}) {
  const [taken, setTaken] = useState(false);
  const click = () => {
    if (taken || locked) return;
    setTaken(true);
    onAnswer(true);
  };
  return (
    <div>
      <div className="chip mb-2">📖 MicroRead · 60s</div>
      <h2 className="h2 mb-2 break-words">{ex.title}</h2>
      <div className="rounded-xl overflow-hidden mb-3 border border-white/5 bg-white/5">
        {/* Mobile-first sizing: a 96 px floor below `sm` keeps the
            illustration legible on a 390 px viewport without crowding the
            text below; sm+ takes the comfortable 144 px tall slot. The
            inner `flex items-center` centers SVGs whose intrinsic aspect
            ratio (typically 5:3) doesn't match the slot. */}
        <div className="h-24 sm:h-36 flex items-center justify-center">
          <Illustration k={ex.visual ?? topicVisual ?? "spark"} className="w-full h-full" />
        </div>
      </div>
      <p className="text-white/85 leading-relaxed text-[15px]">{ex.body}</p>
      <div className="mt-4 p-3 rounded-xl bg-accent/10 border border-accent/30 text-sm">
        💡 <span className="text-white">Takeaway:</span> {ex.takeaway}
      </div>
      <div className="text-xs text-white/40 mt-3">Spark: {title}</div>
      <button className="btn-primary mt-4" disabled={taken || locked} onClick={click}>
        {taken || locked ? "✓ Logged" : "I got it ⚡"}
      </button>
    </div>
  );
}

function TipView({
  ex,
  title,
  locked,
  onAnswer,
}: {
  ex: Extract<Exercise, { type: "tip" }>;
  title: string;
  locked?: boolean;
  onAnswer: (correct: boolean, explain?: string) => void;
}) {
  const [taken, setTaken] = useState(false);
  const click = () => {
    if (taken || locked) return;
    setTaken(true);
    onAnswer(true);
  };
  return (
    <div>
      <div className="chip mb-2 bg-warn/10 border-warn/30 text-warn">💡 Tip & Trick</div>
      <h2 className="h2 mb-2">{ex.title}</h2>
      <p className="text-white/85 text-[15px] leading-relaxed">{ex.body}</p>
      <div className="text-xs text-white/40 mt-3">Spark: {title}</div>
      <button className="btn-primary mt-4" disabled={taken || locked} onClick={click}>
        {taken || locked ? "✓ Logged" : "Got the trick ⚡"}
      </button>
    </div>
  );
}

function QuickPickView({
  ex,
  title,
  locked,
  onAnswer,
}: {
  ex: Extract<Exercise, { type: "quickpick" }>;
  title: string;
  locked?: boolean;
  onAnswer: (correct: boolean, explain?: string) => void;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const isLocked = picked !== null || locked === true;
  return (
    <div>
      <div className="chip mb-2 bg-accent/10 border-accent/30 text-accent">🎯 Quick Pick</div>
      <h2 className="h2 mb-3">{ex.prompt}</h2>
      <div className="space-y-2">
        {ex.options.map((o, i) => {
          const isPicked = picked === i;
          const isCorrect = picked !== null && i === ex.answer;
          const isWrong = picked !== null && isPicked && i !== ex.answer;
          return (
            <button
              key={i}
              disabled={isLocked}
              onClick={() => {
                if (isLocked) return;
                setPicked(i);
                onAnswer(i === ex.answer, ex.explain);
              }}
              className={`w-full text-left px-4 py-3 rounded-xl border transition ${
                picked === null
                  ? "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/30"
                  : isCorrect
                  ? "bg-good/15 border-good text-white"
                  : isWrong
                  ? "bg-bad/15 border-bad text-white"
                  : "bg-white/5 border-white/10 opacity-70"
              }`}
            >
              <span className="font-semibold mr-2 text-white/60">{String.fromCharCode(65 + i)}.</span>
              {o}
            </button>
          );
        })}
      </div>
      <div className="text-xs text-white/40 mt-3">Spark: {title}</div>
    </div>
  );
}

function FillStackView({
  ex,
  title,
  locked,
  onAnswer,
}: {
  ex: Extract<Exercise, { type: "fillstack" }>;
  title: string;
  locked?: boolean;
  onAnswer: (correct: boolean, explain?: string) => void;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const isLocked = picked !== null || locked === true;
  const [a, b] = useMemo(() => ex.prompt.split(/_{3,}/), [ex.prompt]);
  return (
    <div>
      <div className="chip mb-2 bg-accent2/10 border-accent2/30 text-accent2">🧩 Fill the Stack</div>
      <h2 className="h2 mb-2 leading-snug">
        <span>{a}</span>
        <span className={`inline-block min-w-[120px] mx-2 px-3 py-1 rounded-lg text-center align-middle ${
          picked !== null ? (picked === ex.answer ? "bg-good/20 border border-good" : "bg-bad/20 border border-bad") : "bg-white/10 border border-dashed border-white/20 text-white/40"
        }`}>
          {picked !== null ? ex.options[picked] : "____"}
        </span>
        <span>{b}</span>
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {ex.options.map((o, i) => (
          <button
            key={i}
            disabled={isLocked}
            onClick={() => {
              if (isLocked) return;
              setPicked(i);
              onAnswer(i === ex.answer, ex.explain);
            }}
            className={`px-3 py-2 rounded-xl border ${
              picked === null
                ? "bg-white/5 border-white/10 hover:border-white/30"
                : picked === i && i === ex.answer
                ? "bg-good/15 border-good"
                : picked === i
                ? "bg-bad/15 border-bad"
                : "bg-white/5 border-white/10 opacity-60"
            }`}
          >
            {o}
          </button>
        ))}
      </div>
      <div className="text-xs text-white/40 mt-3">Spark: {title}</div>
    </div>
  );
}

function ScenarioView({
  ex,
  title,
  locked,
  onAnswer,
}: {
  ex: Extract<Exercise, { type: "scenario" }>;
  title: string;
  locked?: boolean;
  onAnswer: (correct: boolean, explain?: string) => void;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const isLocked = picked !== null || locked === true;
  return (
    <div>
      <div className="chip mb-2 bg-warn/10 border-warn/30 text-warn">🧪 Field Scenario</div>
      <div className="rounded-xl bg-white/5 border border-white/10 p-3 mb-3 text-white/80 italic">{ex.setup}</div>
      <h2 className="h2 mb-3">{ex.prompt}</h2>
      <div className="space-y-2">
        {ex.options.map((o, i) => (
          <button
            key={i}
            disabled={isLocked}
            onClick={() => {
              if (isLocked) return;
              setPicked(i);
              onAnswer(i === ex.answer, ex.explain);
            }}
            className={`w-full text-left px-4 py-3 rounded-xl border transition ${
              picked === null
                ? "bg-white/5 border-white/10 hover:border-white/30"
                : picked === i && i === ex.answer
                ? "bg-good/15 border-good"
                : picked === i
                ? "bg-bad/15 border-bad"
                : "bg-white/5 border-white/10 opacity-60"
            }`}
          >
            {o}
          </button>
        ))}
      </div>
      <div className="text-xs text-white/40 mt-3">Spark: {title}</div>
    </div>
  );
}

function PatternMatchView({
  ex,
  title,
  locked,
  onAnswer,
}: {
  ex: Extract<Exercise, { type: "patternmatch" }>;
  title: string;
  locked?: boolean;
  onAnswer: (correct: boolean, explain?: string) => void;
}) {
  const [pickedLeft, setPickedLeft] = useState<number | null>(null);
  const [matches, setMatches] = useState<Record<number, number>>({});
  const [doneLocal, setDoneLocal] = useState(false);
  const done = doneLocal || locked === true;
  const setDone = setDoneLocal;

  const rights = useMemo(
    () => ex.pairs.map((_, i) => i).sort(() => Math.random() - 0.5),
    [ex]
  );

  const allMatched = Object.keys(matches).length === ex.pairs.length;

  const submit = () => {
    if (done) return;
    setDone(true);
    let allCorrect = true;
    for (let i = 0; i < ex.pairs.length; i++) {
      if (matches[i] !== i) {
        allCorrect = false;
        break;
      }
    }
    onAnswer(allCorrect, ex.explain);
  };

  return (
    <div>
      <div className="chip mb-2 bg-accent/10 border-accent/30 text-accent">🔗 Pattern Match</div>
      <h2 className="h2 mb-3">{ex.prompt}</h2>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          {ex.pairs.map((p, i) => {
            const matched = matches[i];
            const correct = done && matched === i;
            const wrong = done && matched !== undefined && matched !== i;
            return (
              <button
                key={i}
                onClick={() => !done && setPickedLeft(i)}
                disabled={done}
                className={`w-full text-left px-3 py-2 rounded-xl border transition ${
                  pickedLeft === i ? "bg-accent/15 border-accent" : "bg-white/5 border-white/10"
                } ${correct ? "ring-2 ring-good" : ""} ${wrong ? "ring-2 ring-bad" : ""}`}
              >
                <div className="text-xs text-white/40">{i + 1}.</div>
                <div className="text-white text-sm">{p.left}</div>
                {matched !== undefined && (
                  <div className="text-[11px] text-white/50 mt-1">→ {ex.pairs[matched]?.right}</div>
                )}
              </button>
            );
          })}
        </div>
        <div className="space-y-2">
          {rights.map((r, _idx) => {
            const taken = Object.values(matches).includes(r);
            return (
              <button
                key={r}
                onClick={() => {
                  if (done || pickedLeft === null) return;
                  setMatches((m) => ({ ...m, [pickedLeft]: r }));
                  setPickedLeft(null);
                }}
                disabled={done || taken}
                className={`w-full text-left px-3 py-2 rounded-xl border transition ${
                  taken ? "opacity-40" : "bg-white/5 border-white/10 hover:border-white/30"
                }`}
              >
                {ex.pairs[r].right}
              </button>
            );
          })}
        </div>
      </div>
      <button className="btn-primary mt-4" disabled={!allMatched || done} onClick={submit}>
        Check matches
      </button>
      <div className="text-xs text-white/40 mt-3">Spark: {title}</div>
    </div>
  );
}

function BuildCardView({
  ex,
  title,
  locked,
  onAnswer,
}: {
  ex: Extract<Exercise, { type: "buildcard" }>;
  title: string;
  locked?: boolean;
  onAnswer: (correct: boolean, explain?: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [taken, setTaken] = useState(false);
  const isLocked = taken || locked === true;
  const finish = () => {
    if (isLocked) return;
    setTaken(true);
    onAnswer(true);
  };
  return (
    <div>
      <div className="chip mb-2 bg-accent2/10 border-accent2/30 text-accent2">🛠️ Build Card · try in Claude Code</div>
      <h2 className="h2 mb-1">{ex.title}</h2>
      <p className="muted">{ex.pitch}</p>
      <div className="mt-3 rounded-xl border border-white/10 bg-black/40 p-3 font-mono text-xs whitespace-pre-wrap">
        {ex.promptToCopy}
      </div>
      <div className="flex flex-wrap items-center gap-2 mt-3">
        <button
          className="btn-ghost"
          onClick={async () => {
            await navigator.clipboard.writeText(ex.promptToCopy).catch(() => {});
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          {copied ? "✓ Copied!" : "📋 Copy prompt"}
        </button>
      </div>
      <div className="mt-3 p-3 rounded-xl bg-accent/10 border border-accent/30 text-sm">
        🎯 <span className="text-white">Success when:</span> {ex.successCriteria}
      </div>
      <div className="text-xs text-white/40 mt-3">Spark: {title}</div>
      <div className="flex gap-2 mt-3">
        <button className="btn-primary" disabled={isLocked} onClick={finish}>
          {isLocked ? "✓ Logged" : "Mark as tried ⚡"}
        </button>
        <button className="btn-ghost" disabled={isLocked} onClick={finish}>
          Save for later
        </button>
      </div>
    </div>
  );
}

function PodcastNuggetView({
  ex,
  title,
  locked,
  onAnswer,
}: {
  ex: Extract<Exercise, { type: "podcastnugget" }>;
  title: string;
  locked?: boolean;
  onAnswer: (correct: boolean, explain?: string) => void;
}) {
  const [taken, setTaken] = useState(false);
  const click = () => {
    if (taken || locked) return;
    setTaken(true);
    onAnswer(true);
  };
  const guestLine = ex.source.guestRole
    ? `${ex.source.guest} · ${ex.source.guestRole}`
    : ex.source.guest;
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <a
          href={ex.source.podcastUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="chip bg-warn/10 border-warn/30 text-warn hover:bg-warn/20 transition"
          aria-label={`Open ${ex.source.podcast}`}
        >
          🎙️ {ex.source.podcast}
        </a>
      </div>
      <div className="text-[11px] uppercase tracking-wider text-white/50 mb-1">
        {guestLine}
      </div>
      <h2 className="h2 mb-3 leading-snug">{title}</h2>
      <blockquote className="border-l-4 border-warn/60 pl-3 sm:pl-4 italic text-white/90 text-[15px] leading-relaxed break-words">
        “{ex.quote}”
      </blockquote>
      {ex.source.episodeTitle && (
        <div className="mt-2 text-xs text-white/50 italic break-words">
          {ex.source.episodeTitle}
        </div>
      )}
      <div className="mt-4 p-3 rounded-xl bg-accent/10 border border-accent/30 text-sm">
        💡 <span className="text-white">Takeaway:</span> {ex.takeaway}
      </div>
      {ex.ctaPrompt && (
        <div className="mt-3 p-3 rounded-xl bg-white/5 border border-white/10 text-sm text-white/85">
          <span className="text-accent2 font-semibold">Try this →</span> {ex.ctaPrompt}
        </div>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button className="btn-primary" disabled={taken || locked} onClick={click}>
          {taken || locked ? "✓ Logged" : "Got it ⚡"}
        </button>
        <a
          href={ex.source.podcastUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-warn hover:underline"
        >
          Listen on {ex.source.podcast} →
        </a>
      </div>
    </div>
  );
}

function BossView({
  ex,
  title,
  onAnswer,
}: {
  ex: Extract<Exercise, { type: "boss" }>;
  title: string;
  onAnswer: (correct: boolean, explain?: string) => void;
}) {
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);

  const q = ex.questions[step];
  if (!q) return null;
  const onPick = (i: number) => {
    if (picked !== null) return;
    setPicked(i);
    if (i === q.answer) setScore((s) => s + 1);
  };

  const next = () => {
    setPicked(null);
    if (step + 1 < ex.questions.length) {
      setStep((s) => s + 1);
    } else {
      const finalScore = score + (picked === q.answer ? 0 : 0);
      const passed = finalScore >= Math.ceil(ex.questions.length * 0.66);
      onAnswer(passed, passed ? "👾 Boss defeated! All systems green." : "Boss escaped — try again to lock it in.");
    }
  };

  return (
    <div>
      <div className="chip mb-2 bg-bad/10 border-bad/40 text-bad">👾 Boss Cell · {step + 1}/{ex.questions.length}</div>
      <h2 className="h2 mb-1">{ex.title}</h2>
      <div className="text-xs text-white/40 mb-3">Score: {score}/{step + (picked !== null ? 1 : 0)}</div>
      <div className="card p-4">
        <div className="font-semibold text-white mb-2">{q.prompt}</div>
        <div className="space-y-2">
          {q.options.map((o, i) => (
            <button
              key={i}
              onClick={() => onPick(i)}
              className={`w-full text-left px-4 py-3 rounded-xl border ${
                picked === null
                  ? "bg-white/5 border-white/10 hover:border-white/30"
                  : i === q.answer
                  ? "bg-good/15 border-good"
                  : picked === i
                  ? "bg-bad/15 border-bad"
                  : "bg-white/5 border-white/10 opacity-60"
              }`}
            >
              {o}
            </button>
          ))}
        </div>
        {picked !== null && (
          <>
            <div className="mt-3 text-sm text-white/70">{q.explain}</div>
            <button className="btn-primary mt-3" onClick={next}>
              {step + 1 < ex.questions.length ? "Next →" : "Finish boss"}
            </button>
          </>
        )}
      </div>
      <div className="text-xs text-white/40 mt-3">Spark: {title}</div>
    </div>
  );
}
