import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  defaultState,
  dislikedSparkIds,
  getSparkVote,
  levelCompletion,
  nextRecommendedSpark,
  topicCompletion,
  voteOnSpark,
} from "../store/game";
import { SEED_TOPICS } from "../content";
import { SparkThumbsRow } from "../components/SparkThumbsRow";
import type { PlayerState, Spark, SparkVote } from "../types";

beforeEach(() => {
  window.localStorage.clear();
});
afterEach(() => {
  window.localStorage.clear();
});

function firstTopicWithMultipleSparks() {
  for (const t of SEED_TOPICS) {
    for (const lvl of t.levels) {
      if (lvl.sparks.length >= 2) {
        return { topic: t, level: lvl };
      }
    }
  }
  throw new Error("No topic with a multi-spark level — test fixture broken.");
}

describe("voteOnSpark — pure store helper", () => {
  it("writes a brand-new vote with timestamp", () => {
    const s = defaultState();
    const next = voteOnSpark(s, "s-1", "up", { ts: 1234 });
    expect(next.feedback?.length).toBe(1);
    expect(next.feedback![0]).toMatchObject({ sparkId: "s-1", vote: "up", ts: 1234 });
  });

  it("is idempotent on a repeat of the same vote", () => {
    const s = defaultState();
    const a = voteOnSpark(s, "s-1", "up", { ts: 1 });
    const b = voteOnSpark(a, "s-1", "up", { ts: 2 });
    // No mutation expected — same value, no reason change.
    expect(b).toBe(a);
  });

  it("flips up → down and bumps the timestamp", () => {
    const s = defaultState();
    const a = voteOnSpark(s, "s-1", "up", { ts: 100 });
    const b = voteOnSpark(a, "s-1", "down", { reason: "didn't apply", ts: 200 });
    expect(b.feedback?.length).toBe(1);
    expect(b.feedback![0]).toMatchObject({
      sparkId: "s-1",
      vote: "down",
      reason: "didn't apply",
      ts: 200,
    });
  });

  it("attaches optional context (topicId, levelId, reason) on a 👎", () => {
    const s = defaultState();
    const next = voteOnSpark(s, "s-1", "down", {
      topicId: "ai-builder",
      levelId: "ai-builder-l1",
      reason: "not for me",
      ts: 7,
    });
    expect(next.feedback![0]).toMatchObject({
      sparkId: "s-1",
      vote: "down",
      topicId: "ai-builder",
      levelId: "ai-builder-l1",
      reason: "not for me",
    });
  });
});

describe("derived selectors", () => {
  it("dislikedSparkIds — only down votes count", () => {
    let s = defaultState();
    s = voteOnSpark(s, "s-1", "up");
    s = voteOnSpark(s, "s-2", "down");
    s = voteOnSpark(s, "s-3", "down");
    const set = dislikedSparkIds(s);
    expect(set.has("s-1")).toBe(false);
    expect(set.has("s-2")).toBe(true);
    expect(set.has("s-3")).toBe(true);
  });

  it("getSparkVote — returns the current vote or null", () => {
    let s = defaultState();
    expect(getSparkVote(s, "x")).toBeNull();
    s = voteOnSpark(s, "x", "up");
    expect(getSparkVote(s, "x")).toBe("up");
    s = voteOnSpark(s, "x", "down");
    expect(getSparkVote(s, "x")).toBe("down");
  });
});

describe("nextRecommendedSpark — skips disliked", () => {
  it("returns the first incomplete + non-disliked spark", () => {
    const { topic, level } = firstTopicWithMultipleSparks();
    let s = defaultState();
    // Dislike the very first spark in the unlocked level.
    const first = level.sparks[0];
    const second = level.sparks[1];
    s = voteOnSpark(s, first.id, "down");
    const rec = nextRecommendedSpark(s, topic.id);
    expect(rec).toBeTruthy();
    expect(rec!.spark.id).toBe(second.id);
    expect(rec!.levelId).toBe(level.id);
  });

  it("returns null when every reachable spark is either completed or disliked", () => {
    const { topic, level } = firstTopicWithMultipleSparks();
    let s: PlayerState = defaultState();
    // Mark every spark as either complete or disliked.
    for (const lvl of topic.levels) {
      for (const sp of lvl.sparks) {
        s = voteOnSpark(s, sp.id, "down");
      }
    }
    void level; // keep the lookup around even though we filter all.
    const rec = nextRecommendedSpark(s, topic.id);
    expect(rec).toBeNull();
  });
});

describe("levelCompletion / topicCompletion — disliked sparks come out of the denominator", () => {
  it("levelCompletion: a level with one dislike + four completes is 100%", () => {
    const { topic, level } = firstTopicWithMultipleSparks();
    let s = defaultState();
    const sparks = level.sparks;
    // Dislike the first spark; mark the rest completed via the progress map.
    s = voteOnSpark(s, sparks[0].id, "down");
    s.progress = {
      ...s.progress,
      completed: { [level.id]: sparks.slice(1).map((sp) => sp.id) },
    };
    const completion = levelCompletion(s, topic.id, level.id);
    // total = sparks.length - 1 (one disliked); done = sparks.length - 1.
    expect(completion.total).toBe(sparks.length - 1);
    expect(completion.done).toBe(sparks.length - 1);
    expect(completion.pct).toBe(100);
  });

  it("topicCompletion: a topic with all sparks disliked has total 0", () => {
    const { topic } = firstTopicWithMultipleSparks();
    let s: PlayerState = defaultState();
    for (const lvl of topic.levels) {
      for (const sp of lvl.sparks) {
        s = voteOnSpark(s, sp.id, "down");
      }
    }
    const completion = topicCompletion(s, topic.id);
    expect(completion.total).toBe(0);
    expect(completion.pct).toBe(0);
  });
});

describe("SparkThumbsRow — UI", () => {
  const fakeSpark: Spark = {
    id: "s-fake",
    title: "Fake spark",
    exercise: { type: "tip", title: "Tip", body: "body" },
  };

  function renderRow(currentVote: SparkVote | null = null) {
    const calls: { vote: SparkVote; reason?: string }[] = [];
    const onVote = (vote: SparkVote, reason?: string) => calls.push({ vote, reason });
    const utils = render(
      <SparkThumbsRow
        sparkId={fakeSpark.id}
        sparkTitle={fakeSpark.title}
        topicId="ai-builder"
        levelId="ai-builder-l1"
        currentVote={currentVote}
        onVote={onVote}
      />,
    );
    return { ...utils, calls };
  }

  it("renders both thumbs buttons", () => {
    renderRow();
    expect(screen.getByRole("button", { name: /helpful/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /skip this spark/i })).toBeTruthy();
  });

  it("👍 click fires onVote with 'up' (no reason)", () => {
    const { calls } = renderRow();
    fireEvent.click(screen.getByRole("button", { name: /helpful/i }));
    expect(calls.length).toBe(1);
    expect(calls[0]).toEqual({ vote: "up", reason: undefined });
  });

  it("👍 click is idempotent when already voted up", () => {
    const { calls } = renderRow("up");
    fireEvent.click(screen.getByRole("button", { name: /helpful/i }));
    expect(calls.length).toBe(0);
  });

  it("👎 click fires onVote with 'down' AND reveals the reason input", () => {
    const { calls } = renderRow();
    fireEvent.click(screen.getByRole("button", { name: /skip this spark/i }));
    // Initial down vote fires immediately.
    expect(calls.length).toBe(1);
    expect(calls[0].vote).toBe("down");
    // Reason input now visible.
    expect(screen.getByLabelText(/reason for skipping/i)).toBeTruthy();
  });

  it("submitting a reason fires onVote('down', <reason>)", () => {
    const { calls } = renderRow();
    fireEvent.click(screen.getByRole("button", { name: /skip this spark/i }));
    const input = screen.getByLabelText(/reason for skipping/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "too basic for my level" } });
    fireEvent.click(screen.getByRole("button", { name: /save reason/i }));
    // Two calls in total: (1) initial down click, (2) reason submit.
    expect(calls.length).toBe(2);
    expect(calls[1]).toEqual({ vote: "down", reason: "too basic for my level" });
  });

  it("submitting an empty reason still fires onVote('down') without the reason field", () => {
    const { calls } = renderRow();
    fireEvent.click(screen.getByRole("button", { name: /skip this spark/i }));
    fireEvent.click(screen.getByRole("button", { name: /^done$/i }));
    expect(calls.length).toBe(2);
    expect(calls[1]).toEqual({ vote: "down", reason: undefined });
  });

  it("when currentVote='down', shows the 'won't show again' affordance", () => {
    renderRow("down");
    expect(screen.getByText(/won't show this Spark again/i)).toBeTruthy();
  });

  it("when currentVote='up', shows the 'we'll show more like this' affordance", () => {
    renderRow("up");
    expect(screen.getByText(/show more like this/i)).toBeTruthy();
  });
});
