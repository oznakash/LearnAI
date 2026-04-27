import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import { ExerciseRenderer } from "../components/Exercise";
import type { Exercise } from "../types";

function renderWith(exercise: Exercise, opts: { locked?: boolean } = {}) {
  const calls: { correct: boolean }[] = [];
  const onAnswer = (correct: boolean) => calls.push({ correct });
  const utils = render(
    <ExerciseRenderer
      exercise={exercise}
      title="Spark title"
      locked={opts.locked}
      onAnswer={onAnswer}
    />
  );
  return { ...utils, calls };
}

describe("Exercise renderer — anti-spam lock", () => {
  it("MicroRead: clicking 'I got it' twice only fires onAnswer once", () => {
    const ex: Exercise = {
      type: "microread",
      title: "Read me",
      body: "Body text.",
      takeaway: "Done.",
    };
    const { calls } = renderWith(ex);
    const btn = screen.getByRole("button", { name: /I got it/i });
    fireEvent.click(btn);
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.correct).toBe(true);
  });

  it("Tip: clicking 'Got the trick' twice only fires onAnswer once", () => {
    const ex: Exercise = {
      type: "tip",
      title: "💡 Tip",
      body: "Tip body.",
    };
    const { calls } = renderWith(ex);
    const btn = screen.getByRole("button", { name: /Got the trick/i });
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(calls).toHaveLength(1);
  });

  it("BuildCard: 'Mark as tried' + 'Save for later' together still only fire once", () => {
    const ex: Exercise = {
      type: "buildcard",
      title: "Build",
      pitch: "Pitch.",
      promptToCopy: "Do it",
      successCriteria: "It works.",
    };
    const { calls } = renderWith(ex);
    const tried = screen.getByRole("button", { name: /Mark as tried/i });
    const save = screen.getByRole("button", { name: /Save for later/i });
    fireEvent.click(tried);
    fireEvent.click(save);
    fireEvent.click(tried);
    expect(calls).toHaveLength(1);
  });

  it("QuickPick: clicking the same option twice only fires once", () => {
    const ex: Exercise = {
      type: "quickpick",
      prompt: "Pick",
      options: ["a", "b", "c"],
      answer: 1,
      explain: "x",
    };
    const { calls } = renderWith(ex);
    const opt = screen.getByRole("button", { name: /A\..*a/ });
    fireEvent.click(opt);
    fireEvent.click(opt);
    expect(calls).toHaveLength(1);
  });

  it("QuickPick: clicking a second option after the first does nothing", () => {
    const ex: Exercise = {
      type: "quickpick",
      prompt: "Pick",
      options: ["a", "b"],
      answer: 1,
      explain: "x",
    };
    const { calls } = renderWith(ex);
    const a = screen.getByRole("button", { name: /A\..*a/ });
    const b = screen.getByRole("button", { name: /B\..*b/ });
    fireEvent.click(a); // wrong
    fireEvent.click(b); // should be ignored
    expect(calls).toHaveLength(1);
    expect(calls[0]?.correct).toBe(false);
  });

  it("MicroRead: external `locked` prop disables the button before any click", () => {
    const ex: Exercise = {
      type: "microread",
      title: "Read me",
      body: "Body.",
      takeaway: "Tk.",
    };
    const { calls } = renderWith(ex, { locked: true });
    const btn = screen.getByRole("button", { name: /Logged|I got it/i });
    fireEvent.click(btn);
    expect(calls).toHaveLength(0);
  });
});
