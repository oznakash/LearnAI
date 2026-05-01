import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  defaultState,
  recordSparkSignal,
  softSkippedSparkIds,
} from "../store/game";
import { SparkThumbsRow } from "../components/SparkThumbsRow";
import type { SparkSignal } from "../types";

const LENNY_ROOT = "https://www.lennysnewsletter.com/podcast";

describe("recordSparkSignal — pure store helper", () => {
  it("appends a `zoom` signal with timestamp", () => {
    const s = defaultState();
    const next = recordSparkSignal(s, "s-1", "zoom", { ts: 100 });
    expect(next.signals).toHaveLength(1);
    expect(next.signals![0]).toMatchObject({
      sparkId: "s-1",
      signal: "zoom",
      ts: 100,
    });
  });

  it("captures optional reason text on a zoom signal (high-quality content authoring signal)", () => {
    const s = defaultState();
    const next = recordSparkSignal(s, "s-1", "zoom", {
      reason: "What's prompt caching exactly?",
      topicId: "ai-builder",
      levelId: "ai-builder-l5",
      ts: 200,
    });
    expect(next.signals![0]).toMatchObject({
      sparkId: "s-1",
      signal: "zoom",
      reason: "What's prompt caching exactly?",
      topicId: "ai-builder",
      levelId: "ai-builder-l5",
    });
  });

  it("appends a `skip-not-now` signal", () => {
    const s = defaultState();
    const next = recordSparkSignal(s, "s-2", "skip-not-now", { ts: 300 });
    expect(next.signals).toHaveLength(1);
    expect(next.signals![0]).toMatchObject({
      sparkId: "s-2",
      signal: "skip-not-now",
      ts: 300,
    });
  });

  it("allows multiple signals on the same spark across sessions (zoom is not idempotent)", () => {
    let s = defaultState();
    s = recordSparkSignal(s, "s-1", "zoom", { ts: 100 });
    s = recordSparkSignal(s, "s-1", "zoom", { reason: "follow-up question", ts: 500 });
    expect(s.signals).toHaveLength(2);
    // newest first
    expect(s.signals![0].reason).toBe("follow-up question");
    expect(s.signals![1].reason).toBeUndefined();
  });
});

describe("softSkippedSparkIds — derived selector", () => {
  it("returns only soft-skipped (not zoom) within the optional time window", () => {
    let s = defaultState();
    s = recordSparkSignal(s, "s-zoomed", "zoom", { ts: 100 });
    s = recordSparkSignal(s, "s-skipped", "skip-not-now", { ts: 200 });
    s = recordSparkSignal(s, "s-skipped-old", "skip-not-now", { ts: 50 });
    const all = softSkippedSparkIds(s, 0);
    expect(all.has("s-zoomed")).toBe(false);
    expect(all.has("s-skipped")).toBe(true);
    expect(all.has("s-skipped-old")).toBe(true);
    // window-restricted
    const recent = softSkippedSparkIds(s, 150);
    expect(recent.has("s-skipped")).toBe(true);
    expect(recent.has("s-skipped-old")).toBe(false);
  });

  it("returns an empty set when there are no signals", () => {
    const s = defaultState();
    expect(softSkippedSparkIds(s).size).toBe(0);
  });
});

describe("SparkThumbsRow — state-of-mind row", () => {
  function renderRow(opts: { sourceUrl?: string; sourceLabel?: string } = {}) {
    const signalCalls: { signal: SparkSignal; reason?: string }[] = [];
    const voteCalls: { vote: string; reason?: string }[] = [];
    const onSignal = (signal: SparkSignal, reason?: string) =>
      signalCalls.push({ signal, reason });
    const onVote = (vote: string, reason?: string) => voteCalls.push({ vote, reason });
    const utils = render(
      <SparkThumbsRow
        sparkId="s-1"
        sparkTitle="Test spark"
        topicId="ai-builder"
        levelId="ai-builder-l1"
        currentVote={null}
        onVote={onVote}
        onSignal={onSignal}
        sourceUrl={opts.sourceUrl}
        sourceLabel={opts.sourceLabel}
      />,
    );
    return { ...utils, signalCalls, voteCalls };
  }

  it("renders both rows — quality + state-of-mind", () => {
    renderRow();
    expect(screen.getByRole("button", { name: /helpful/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /skip this spark forever/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /zoom in/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /skip for now/i })).toBeTruthy();
  });

  it("Zoom in button fires `onSignal('zoom')` and reveals the reason input", () => {
    const { signalCalls } = renderRow();
    fireEvent.click(screen.getByRole("button", { name: /zoom in/i }));
    expect(signalCalls).toHaveLength(1);
    expect(signalCalls[0]).toEqual({ signal: "zoom", reason: undefined });
    expect(screen.getByLabelText(/what did you want to know more about/i)).toBeTruthy();
  });

  it("submitting a zoom reason fires a second signal carrying the reason", () => {
    const { signalCalls } = renderRow();
    fireEvent.click(screen.getByRole("button", { name: /zoom in/i }));
    const input = screen.getByLabelText(/what did you want to know more about/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "How does prompt caching work in Anthropic SDK?" } });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
    expect(signalCalls).toHaveLength(2);
    expect(signalCalls[1]).toEqual({
      signal: "zoom",
      reason: "How does prompt caching work in Anthropic SDK?",
    });
    expect(screen.getByText(/we'll surface deeper Sparks/i)).toBeTruthy();
  });

  it("submitting a blank zoom reason does NOT fire a second signal", () => {
    const { signalCalls } = renderRow();
    fireEvent.click(screen.getByRole("button", { name: /zoom in/i }));
    fireEvent.click(screen.getByRole("button", { name: /^done$/i }));
    expect(signalCalls).toHaveLength(1);
  });

  it("when sourceUrl is provided, a `📚 See source` link appears on Zoom-in expansion", () => {
    renderRow({ sourceUrl: LENNY_ROOT, sourceLabel: "Listen on Lenny's Podcast" });
    fireEvent.click(screen.getByRole("button", { name: /zoom in/i }));
    const link = screen.getByText(/Listen on Lenny's Podcast/i).closest("a") as HTMLAnchorElement;
    expect(link).toBeTruthy();
    expect(link.href).toBe(LENNY_ROOT);
    expect(link.target).toBe("_blank");
    expect(link.rel).toContain("noopener");
  });

  it("Skip for now fires `onSignal('skip-not-now')` exactly once per click", () => {
    const { signalCalls } = renderRow();
    fireEvent.click(screen.getByRole("button", { name: /skip for now/i }));
    expect(signalCalls).toHaveLength(1);
    expect(signalCalls[0]).toEqual({ signal: "skip-not-now", reason: undefined });
  });

  it("repeated Zoom-in click is a no-op (panel stays open, no extra signal fires)", () => {
    const { signalCalls } = renderRow();
    fireEvent.click(screen.getByRole("button", { name: /zoom in/i }));
    fireEvent.click(screen.getByRole("button", { name: /zoom in/i }));
    fireEvent.click(screen.getByRole("button", { name: /zoom in/i }));
    expect(signalCalls).toHaveLength(1);
  });

  it("does NOT render the state-of-mind row when `onSignal` prop is omitted (back-compat)", () => {
    render(
      <SparkThumbsRow
        sparkId="s-1"
        sparkTitle="Test spark"
        topicId="ai-builder"
        levelId="ai-builder-l1"
        currentVote={null}
        onVote={vi.fn()}
        // intentionally no onSignal
      />,
    );
    expect(screen.queryByRole("button", { name: /zoom in/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /skip for now/i })).toBeNull();
  });

  it("👍/👎 row still works alongside the new state-of-mind row (no regression)", () => {
    const { voteCalls } = renderRow();
    fireEvent.click(screen.getByRole("button", { name: /helpful/i }));
    expect(voteCalls).toEqual([{ vote: "up", reason: undefined }]);
  });
});
