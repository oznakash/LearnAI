import { useMemo, useState } from "react";
import type { AgeBand, Creator, Exercise, VisualKey } from "../types";
import { Illustration } from "../visuals/Illustrations";
import { VocabBody } from "./VocabBody";
import { getCreator } from "../admin/runtime";

interface Props {
  exercise: Exercise;
  title: string;
  topicVisual?: VisualKey;
  /** True once this Spark has been answered; the renderer disables further input. */
  locked?: boolean;
  onAnswer: (correct: boolean, explain?: string) => void;
  /**
   * Optional age band — `kid` / `teen` / `adult`. Used by `MicroRead`
   * and `Tip` to pick `bodyByAgeBand[ageBand]` over the default `body`
   * when an alternate framing is authored. See `docs/content-freshness.md`
   * §4 for the kid-voice rules. Defaults to `"adult"` when unset.
   */
  ageBand?: AgeBand;
  /**
   * Fires when the user taps an inline vocabulary term in a Spark body.
   * Lets the parent record a `vocabulary`-category memory.
   */
  onVocabTap?: (term: string, definition: string) => void;
  /**
   * Fires when the user taps "🔍 Zoom in on this →" inside the
   * inline definition strip. The parent typically forwards to
   * `signalSpark(spark.id, "zoom", { reason: \`Wants more on: ${term}\` })`.
   */
  onVocabZoom?: (term: string) => void;
}

export function ExerciseRenderer({ exercise, title, topicVisual, locked, onAnswer, onVocabTap, onVocabZoom, ageBand }: Props) {
  switch (exercise.type) {
    case "microread":
      return <MicroReadView ex={exercise} title={title} topicVisual={topicVisual} locked={locked} onAnswer={onAnswer} onVocabTap={onVocabTap} onVocabZoom={onVocabZoom} ageBand={ageBand} />;
    case "tip":
      return <TipView ex={exercise} title={title} locked={locked} onAnswer={onAnswer} onVocabTap={onVocabTap} onVocabZoom={onVocabZoom} ageBand={ageBand} />;
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
    case "youtubenugget":
      return <YoutubeNuggetView ex={exercise} title={title} locked={locked} onAnswer={onAnswer} />;
  }
}

function MicroReadView({
  ex,
  title,
  topicVisual,
  locked,
  onAnswer,
  onVocabTap,
  onVocabZoom,
  ageBand,
}: {
  ex: Extract<Exercise, { type: "microread" }>;
  title: string;
  topicVisual?: VisualKey;
  locked?: boolean;
  onAnswer: (correct: boolean, explain?: string) => void;
  onVocabTap?: (term: string, definition: string) => void;
  onVocabZoom?: (term: string) => void;
  ageBand?: AgeBand;
}) {
  // Age-band picker: kids, teens, and adults can each get a tonally-
  // calibrated body. Falls back to the default `body` when no variant
  // is authored — fully back-compat for the existing 480 Sparks.
  const body = ex.bodyByAgeBand?.[ageBand ?? "adult"] ?? ex.body;
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
      <VocabBody body={body} vocab={ex.vocab} onTermTap={onVocabTap} onZoom={onVocabZoom} />
      <div className="mt-4 p-3 rounded-xl bg-accent/10 border border-accent/30 text-sm">
        💡 <span className="text-white">Takeaway:</span> {ex.takeaway}
      </div>
      {ex.source && <SourceChip source={ex.source} />}
      {ex.addedAt && <FreshnessChip addedAt={ex.addedAt} category={ex.category} />}
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
  onVocabTap,
  onVocabZoom,
  ageBand,
}: {
  ex: Extract<Exercise, { type: "tip" }>;
  title: string;
  locked?: boolean;
  onAnswer: (correct: boolean, explain?: string) => void;
  onVocabTap?: (term: string, definition: string) => void;
  onVocabZoom?: (term: string) => void;
  ageBand?: AgeBand;
}) {
  const [taken, setTaken] = useState(false);
  const click = () => {
    if (taken || locked) return;
    setTaken(true);
    onAnswer(true);
  };
  // See MicroReadView for the age-band fallback rationale.
  const body = ex.bodyByAgeBand?.[ageBand ?? "adult"] ?? ex.body;
  return (
    <div>
      <div className="chip mb-2 bg-warn/10 border-warn/30 text-warn">💡 Tip & Trick</div>
      <h2 className="h2 mb-2">{ex.title}</h2>
      <VocabBody body={body} vocab={ex.vocab} onTermTap={onVocabTap} onZoom={onVocabZoom} />
      {ex.source && <SourceChip source={ex.source} />}
      {ex.addedAt && <FreshnessChip addedAt={ex.addedAt} category={ex.category} />}
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

/**
 * Resolves a podcast nugget's credit fields from the creator registry
 * first (the modern path) and falls back to the inline `source` object
 * for back-compat with seeds authored before the registry shipped.
 */
function resolveNuggetCredit(ex: Extract<Exercise, { type: "podcastnugget" }>) {
  const creator: Creator | undefined = getCreator(ex.creatorId);
  const name = creator?.name ?? ex.source.podcast;
  const url = creator?.creditUrl ?? ex.source.podcastUrl;
  const label = creator?.creditLabel ?? `Listen on ${ex.source.podcast}`;
  const avatarUrl = creator?.avatarUrl;
  const avatarEmoji = creator?.avatarEmoji ?? "🎙️";
  return { name, url, label, avatarUrl, avatarEmoji };
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
  const credit = resolveNuggetCredit(ex);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <a
          href={credit.url}
          target="_blank"
          rel="noopener noreferrer"
          className="chip bg-warn/10 border-warn/30 text-warn hover:bg-warn/20 transition"
          aria-label={`Open ${credit.name}`}
        >
          {credit.avatarUrl ? (
            <img
              src={credit.avatarUrl}
              alt=""
              className="w-4 h-4 rounded-full object-cover -ml-0.5 mr-1 inline-block"
            />
          ) : (
            <span className="mr-1">{credit.avatarEmoji}</span>
          )}
          {credit.name}
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
          href={credit.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-warn hover:underline"
        >
          {credit.label} →
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

/**
 * Quiet attribution chip rendered below the body of any source-anchored
 * Spark (MicroRead, Tip — extends to future EssayNugget / ReleaseNote
 * variants). Same shape as the prominent `🎙️ Lenny's Podcast` chip on
 * `PodcastNugget`, but smaller and unobtrusive — the source is *evidence*,
 * not the headline. See `docs/aha-and-network.md` §2.3 for the trust
 * rationale.
 */
function SourceChip({ source }: { source: { name: string; url: string } }) {
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-3 inline-flex items-center gap-1.5 text-xs text-white/55 hover:text-white/85 transition"
      aria-label={`Source: ${source.name}`}
    >
      <span aria-hidden="true">📎</span>
      <span>Source: {source.name}</span>
      <span aria-hidden="true">→</span>
    </a>
  );
}

/**
 * Video-anchored Spark — same compression rubric and curation
 * discipline as `PodcastNugget`, different source. Pilot constraints
 * (per `docs/content-freshness.md` §7): video duration ≥ 5 min, video
 * published ≤ 60 days at curation, quote ≤ 60 words, link opens the
 * original video in a new tab.
 *
 * Render parallel to PodcastNuggetView. The chip is YouTube-red so it
 * reads visually distinct from a podcast nugget at a glance.
 */
function YoutubeNuggetView({
  ex,
  title,
  locked,
  onAnswer,
}: {
  ex: Extract<Exercise, { type: "youtubenugget" }>;
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
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <a
          href={ex.source.videoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="chip bg-bad/10 border-bad/30 text-bad hover:bg-bad/20 transition"
          aria-label={`Watch on YouTube — ${ex.source.channelName}`}
        >
          🎥 YouTube · {ex.source.channelName}
        </a>
      </div>
      <div className="text-[11px] uppercase tracking-wider text-white/50 mb-1">
        {ex.source.videoTitle}
        {ex.source.timestamp && (
          <span className="text-white/40 ml-2">@ {ex.source.timestamp}</span>
        )}
      </div>
      <h2 className="h2 mb-3 leading-snug">{title}</h2>
      <blockquote className="border-l-4 border-bad/60 pl-3 sm:pl-4 italic text-white/90 text-[15px] leading-relaxed break-words">
        “{ex.quote}”
      </blockquote>
      <div className="mt-4 p-3 rounded-xl bg-accent/10 border border-accent/30 text-sm">
        💡 <span className="text-white">Takeaway:</span> {ex.takeaway}
      </div>
      {ex.ctaPrompt && (
        <div className="mt-3 p-3 rounded-xl bg-white/5 border border-white/10 text-sm text-white/85">
          <span className="text-accent2 font-semibold">Try this →</span> {ex.ctaPrompt}
        </div>
      )}
      {ex.addedAt && <FreshnessChip addedAt={ex.addedAt} category={ex.category} />}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button className="btn-primary" disabled={taken || locked} onClick={click}>
          {taken || locked ? "✓ Logged" : "Got it ⚡"}
        </button>
        <a
          href={ex.source.videoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-bad hover:underline"
        >
          Watch on YouTube →
        </a>
      </div>
    </div>
  );
}

/**
 * A small chip that surfaces the freshness state of a Spark — "fresh"
 * (within shelf life), "aging" (between 0.5× and 1×), or "stale" (past
 * 1×). Quiet by default; only shown when both `addedAt` and `category`
 * are set on the host Spark. See `docs/content-freshness.md` §2.2.
 *
 * The shelf life lookup is local — keeping the renderer pure and
 * avoiding a runtime dep on the admin config.
 */
function FreshnessChip({
  addedAt,
  category,
}: {
  addedAt: string;
  category?: import("../types").SparkCategory;
}) {
  if (!category) {
    // Without a category we can't apply a shelf life. Just show the
    // addedAt date as a neutral fact — useful provenance, no warning.
    return (
      <div className="mt-3 text-[11px] text-white/45">
        📅 Added {formatDate(addedAt)}
      </div>
    );
  }

  // Shelf-life table (in days), per docs/content-freshness.md §2.1.
  const SHELF_DAYS: Record<import("../types").SparkCategory, number> = {
    principle: 730,
    pattern: 180,
    tooling: 90,
    company: 30,
    news: 14,
    frontier: 7,
  };
  const shelf = SHELF_DAYS[category];
  const ageDays = Math.max(
    0,
    Math.floor((Date.now() - new Date(addedAt).getTime()) / (1000 * 60 * 60 * 24)),
  );
  const ratio = shelf > 0 ? ageDays / shelf : 0;

  let label: string;
  let className: string;
  if (ratio < 0.5) {
    label = `📅 Added ${formatDate(addedAt)}`;
    className = "text-white/45";
  } else if (ratio < 1) {
    label = `🕒 Aging — added ${formatDate(addedAt)}`;
    className = "text-warn/85";
  } else {
    label = `⚠️ May be stale — added ${formatDate(addedAt)}`;
    className = "text-bad/85";
  }
  return <div className={`mt-3 text-[11px] ${className}`}>{label}</div>;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}
