import { useState } from "react";
import type { SparkSignal, SparkVote, TopicId } from "../types";

/**
 * Eight critique chips a user can tap on a 👎 vote. Each maps to a
 * memory-category `critique` write that aggregates *across Sparks of
 * the same shape* — biasing future content generation, not just future
 * ranking of the disliked Spark. See `docs/content-freshness.md` §5.
 *
 * Why structured chips beat free text: at small N, per-Spark vote
 * counts are noisy; structured critique signal aggregates into a
 * generation prompt bias even with N=50.
 */
export const CRITIQUE_CHIPS = [
  { id: "too-theoretical", emoji: "🪨", label: "Too theoretical" },
  { id: "wrong-examples", emoji: "🧪", label: "Wrong examples" },
  { id: "outdated", emoji: "🪦", label: "Outdated" },
  { id: "too-jargon", emoji: "🧠", label: "Too jargon-heavy" },
  { id: "watered-down", emoji: "🦠", label: "Watered down" },
  { id: "wrong-level", emoji: "📏", label: "Wrong level" },
  { id: "too-long", emoji: "📜", label: "Too long" },
] as const;
export type CritiqueChipId = (typeof CRITIQUE_CHIPS)[number]["id"];

/**
 * The Spark action surface — two rows.
 *
 * Top row (quality rating about the Spark itself):
 *   👍 helpful · 👎 skip forever
 *
 * Bottom row (state-of-mind signals — about the user, not the Spark):
 *   🔍 Zoom in · ⏭ Skip for now
 *
 * The two rows are intentionally separate. 👎 is **permanent** (never
 * show this Spark again on this device). ⏭ is **for now only** — current
 * session skips it; the Spark can resurface later. 🔍 captures intent
 * for the cognition layer to surface deeper Sparks; with a source-link
 * present (e.g. PodcastNugget), we also surface the source as the
 * immediate way to go deeper.
 *
 * Component is presentation-only. The cognition-layer write (memory
 * `add`) is the parent's job — keeps the Player ↔ Memory boundary clean.
 */
export function SparkThumbsRow({
  sparkId,
  sparkTitle,
  topicId: _topicId,
  levelId: _levelId,
  currentVote,
  onVote,
  onSignal,
  sourceUrl,
  sourceLabel,
  hideSignalRow = false,
  onCritique,
}: {
  sparkId: string;
  sparkTitle: string;
  topicId: TopicId;
  levelId: string;
  currentVote: SparkVote | null;
  onVote: (vote: SparkVote, reason?: string) => void;
  /**
   * Fires for state-of-mind signals (zoom / skip-not-now). Multiple
   * fires per Spark are valid — the parent records each one. The
   * parent typically advances the queue on `skip-not-now`; for `zoom`
   * the parent leaves the user on the Spark to read deeper.
   */
  onSignal?: (signal: SparkSignal, reason?: string) => void;
  /** When present, surfaces a "📚 See source →" affordance on Zoom-in. */
  sourceUrl?: string;
  sourceLabel?: string;
  /**
   * Hide the lower state-of-mind row (🔍 Zoom in / ⏭ Skip for now)
   * even when `onSignal` is provided. Used by the FTUE progressive
   * disclosure: 👍/👎 unlock at stage `engaged`, but the signal row
   * stays hidden until stage `returning`. Default: false (show).
   */
  hideSignalRow?: boolean;
  /**
   * Fires when the user taps a critique chip on a 👎 vote. The parent
   * writes a `critique`-category memory whose aggregate biases future
   * content generation. See `docs/content-freshness.md` §5.
   */
  onCritique?: (chip: CritiqueChipId) => void;
}) {
  // Quality-rating (👎) reason input state.
  const [showVoteReason, setShowVoteReason] = useState(false);
  const [voteReason, setVoteReason] = useState("");
  const [tappedChips, setTappedChips] = useState<Set<CritiqueChipId>>(new Set());

  const toggleChip = (id: CritiqueChipId) => {
    setTappedChips((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        onCritique?.(id);
      }
      return next;
    });
  };

  // Zoom-in panel state.
  const [zoomedIn, setZoomedIn] = useState(false);
  const [zoomReason, setZoomReason] = useState("");
  const [zoomSubmitted, setZoomSubmitted] = useState(false);

  const onUp = () => {
    if (currentVote === "up") return;
    onVote("up");
    setShowVoteReason(false);
  };

  const onDown = () => {
    if (currentVote !== "down") {
      onVote("down");
    }
    setShowVoteReason(true);
  };

  const submitVoteReason = () => {
    const trimmed = voteReason.trim();
    onVote("down", trimmed || undefined);
    setShowVoteReason(false);
  };

  const onZoom = () => {
    if (!zoomedIn) {
      // First click — fire the bare zoom signal, expand the panel
      // for an optional reason.
      onSignal?.("zoom");
      setZoomedIn(true);
    }
  };

  const submitZoomReason = () => {
    const trimmed = zoomReason.trim();
    if (trimmed) {
      onSignal?.("zoom", trimmed);
    }
    setZoomSubmitted(true);
  };

  const onSkipNow = () => {
    // Caller is responsible for advancing the Spark queue. The signal
    // capture is independent — fires whether or not the queue moves.
    onSignal?.("skip-not-now");
  };

  return (
    <div className="space-y-2">
      <div
        className="card p-3 sm:p-4 flex flex-wrap items-center gap-3"
        role="group"
        aria-label={`Quality feedback for spark ${sparkTitle}`}
      >
        <div className="text-xs text-white/55 mr-1 flex-1 min-w-[140px]">
          Was this Spark useful?
        </div>
        <button
          type="button"
          onClick={onUp}
          aria-pressed={currentVote === "up"}
          aria-label="Helpful"
          className={`pill text-sm transition ${
            currentVote === "up"
              ? "bg-good/20 border border-good text-good"
              : "bg-white/5 border border-white/10 text-white/80 hover:text-white hover:border-white/30"
          }`}
        >
          👍 helpful
        </button>
        <button
          type="button"
          onClick={onDown}
          aria-pressed={currentVote === "down"}
          aria-label="Skip this spark forever"
          className={`pill text-sm transition ${
            currentVote === "down"
              ? "bg-bad/20 border border-bad text-bad"
              : "bg-white/5 border border-white/10 text-white/80 hover:text-white hover:border-white/30"
          }`}
        >
          👎 skip forever
        </button>
        {currentVote === "up" && (
          <span className="text-xs text-good/90">Thanks — we'll show more like this.</span>
        )}
        {currentVote === "down" && !showVoteReason && (
          <span className="text-xs text-white/60">
            Skipped. We won't show this Spark again.
          </span>
        )}
        {showVoteReason && (
          <div className="basis-full flex flex-col gap-2 mt-2">
            {onCritique && (
              <div className="flex flex-wrap gap-1.5">
                {CRITIQUE_CHIPS.map((chip) => {
                  const tapped = tappedChips.has(chip.id);
                  return (
                    <button
                      key={chip.id}
                      type="button"
                      onClick={() => toggleChip(chip.id)}
                      aria-pressed={tapped}
                      className={`pill text-[11px] transition ${
                        tapped
                          ? "bg-bad/20 border border-bad text-bad"
                          : "bg-white/5 border border-white/10 text-white/70 hover:border-white/30 hover:text-white"
                      }`}
                    >
                      {chip.emoji} {chip.label}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                placeholder="(optional) Tell us why — one line"
                value={voteReason}
                onChange={(e) => setVoteReason(e.target.value.slice(0, 200))}
                className="input flex-1 text-sm"
                aria-label="Reason for skipping"
              />
              <button type="button" onClick={submitVoteReason} className="btn-primary text-xs">
                {voteReason.trim() ? "Save reason" : "Done"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowVoteReason(false);
                  setVoteReason("");
                  setTappedChips(new Set());
                }}
                className="btn-ghost text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        {currentVote === null && (
          <span className="text-[11px] text-white/40 hidden sm:inline">
            (👎 = never show again on this device)
          </span>
        )}
        <span className="sr-only" data-testid="spark-id">{sparkId}</span>
      </div>

      {onSignal && !hideSignalRow && (
        <div
          className="card p-3 sm:p-4 flex flex-wrap items-center gap-3"
          role="group"
          aria-label={`State-of-mind for spark ${sparkTitle}`}
        >
          <div className="text-xs text-white/55 mr-1 flex-1 min-w-[140px]">
            Want more, or not the right moment?
          </div>
          <button
            type="button"
            onClick={onZoom}
            aria-pressed={zoomedIn}
            aria-label="Zoom in — I want to go deeper"
            className={`pill text-sm transition ${
              zoomedIn
                ? "bg-accent/20 border border-accent text-accent"
                : "bg-white/5 border border-white/10 text-white/80 hover:text-white hover:border-white/30"
            }`}
          >
            🔍 Zoom in
          </button>
          <button
            type="button"
            onClick={onSkipNow}
            aria-label="Skip for now — not the right moment"
            className="pill text-sm transition bg-white/5 border border-white/10 text-white/80 hover:text-white hover:border-white/30"
          >
            ⏭ Skip for now
          </button>
          {zoomedIn && (
            <div className="basis-full flex flex-col gap-2 mt-1">
              {sourceUrl && (
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-warn hover:underline"
                >
                  📚 {sourceLabel ?? "See the source"} →
                </a>
              )}
              {zoomSubmitted ? (
                <div className="text-xs text-accent/90">
                  Got it — we'll surface deeper Sparks on this when more land.
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    placeholder="(optional) What did you want to know more about?"
                    value={zoomReason}
                    onChange={(e) => setZoomReason(e.target.value.slice(0, 240))}
                    className="input flex-1 text-sm"
                    aria-label="What did you want to know more about?"
                  />
                  <button type="button" onClick={submitZoomReason} className="btn-primary text-xs">
                    {zoomReason.trim() ? "Save" : "Done"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
