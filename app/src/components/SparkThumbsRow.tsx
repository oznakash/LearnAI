import { useState } from "react";
import type { SparkVote, TopicId } from "../types";

/**
 * Two thumbs (👍 / 👎) plus an optional one-line "why?" on a 👎 vote.
 *
 * - 👎 is the **permanent skip** signal — the spark never shows again
 *   for this user on this device. Skipping is wired through
 *   `dislikedSparkIds()` in `store/game.ts`.
 * - The cognition-layer write (mem0 `preference` memory) is the parent's
 *   responsibility — this component is a pure presentation surface that
 *   keeps the Player ↔ Memory boundary clean.
 */
export function SparkThumbsRow({
  sparkId,
  sparkTitle,
  topicId: _topicId,
  levelId: _levelId,
  currentVote,
  onVote,
}: {
  sparkId: string;
  sparkTitle: string;
  topicId: TopicId;
  levelId: string;
  currentVote: SparkVote | null;
  onVote: (vote: SparkVote, reason?: string) => void;
}) {
  const [showReason, setShowReason] = useState(false);
  const [reason, setReason] = useState("");

  const onUp = () => {
    if (currentVote === "up") return;
    onVote("up");
    setShowReason(false);
  };

  const onDown = () => {
    if (currentVote !== "down") {
      onVote("down");
    }
    setShowReason(true);
  };

  const submitReason = () => {
    const trimmed = reason.trim();
    onVote("down", trimmed || undefined);
    setShowReason(false);
  };

  return (
    <div
      className="card p-3 sm:p-4 flex flex-wrap items-center gap-3"
      role="group"
      aria-label={`Feedback for spark ${sparkTitle}`}
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
        👎 skip this
      </button>
      {currentVote === "up" && (
        <span className="text-xs text-good/90">Thanks — we'll show more like this.</span>
      )}
      {currentVote === "down" && !showReason && (
        <span className="text-xs text-white/60">
          Skipped. We won't show this Spark again.
        </span>
      )}
      {showReason && (
        <div className="basis-full flex flex-wrap items-center gap-2 mt-1">
          <input
            type="text"
            placeholder="(optional) Tell us why — one line"
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, 200))}
            className="input flex-1 text-sm"
            aria-label="Reason for skipping"
          />
          <button type="button" onClick={submitReason} className="btn-primary text-xs">
            {reason.trim() ? "Save reason" : "Done"}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowReason(false);
              setReason("");
            }}
            className="btn-ghost text-xs"
          >
            Cancel
          </button>
        </div>
      )}
      {currentVote === null && (
        <span className="text-[11px] text-white/40 hidden sm:inline">
          (👎 = never show again on this device)
        </span>
      )}
      <span className="sr-only" data-testid="spark-id">{sparkId}</span>
    </div>
  );
}
