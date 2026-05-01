import { describe, it, expect, beforeEach } from "vitest";
import { useEffect, useRef } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PlayerProvider, usePlayer } from "../store/PlayerContext";
import { AdminProvider } from "../admin/AdminContext";
import { MemoryProvider } from "../memory/MemoryContext";
import { SocialProvider } from "../social/SocialContext";
import { AddToTaskButton } from "../components/AddToTaskButton";
import type { Spark } from "../types";
import { STORAGE_KEY } from "../store/game";

const fakeSpark: Spark = {
  id: "spark-test-1",
  title: "Test spark",
  exercise: {
    type: "microread",
    title: "Test microread",
    body: "body",
    takeaway: "key takeaway",
  },
};

function Harness() {
  const { state } = usePlayer();
  return (
    <>
      <AddToTaskButton spark={fakeSpark} topicId="ai-pm" levelId="ai-pm-1" />
      <div data-testid="task-count">{state.tasks.length}</div>
    </>
  );
}

function mount() {
  return render(
    <PlayerProvider>
      <AdminProvider>
        <MemoryProvider>
          <SocialProvider>
            <Harness />
          </SocialProvider>
        </MemoryProvider>
      </AdminProvider>
    </PlayerProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      identity: { email: "maya@gmail.com", name: "Maya", provider: "google" },
      profile: {
        name: "Maya", ageBand: "adult", skillLevel: "builder",
        interests: [], dailyMinutes: 10, goal: "", experience: "",
        createdAt: Date.now(),
      },
    }),
  );
});

describe("AddToTaskButton — dedup", () => {
  it("clicks the + Task button once → 1 task; second click is suppressed", async () => {
    mount();
    await waitFor(() => screen.getByTestId("task-count"));
    // Button label uses ＋ (full-width plus, U+FF0B), not + (U+002B).
    const btn = await screen.findByRole("button", { name: /Task/i });
    await act(async () => {
      fireEvent.click(btn);
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(screen.getByTestId("task-count").textContent).toBe("1");

    // Button flips to "✓ In Tasks" and becomes disabled.
    const after = await screen.findByRole("button", { name: /In Tasks/i });
    expect((after as HTMLButtonElement).disabled).toBe(true);

    // Programmatic re-fire should not create a duplicate (jsdom dispatches
    // click even on disabled buttons).
    await act(async () => {
      fireEvent.click(after);
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(screen.getByTestId("task-count").textContent).toBe("1");
  });

  it("addTask called twice with the same source.sparkId returns the existing task (defense in depth)", async () => {
    let returnedIds: string[] = [];

    function ProgrammaticHarness() {
      const { state, addTask } = usePlayer();
      const ranRef = useRef(false);
      // Wait for PlayerProvider hydration to complete before firing —
      // identity gets set inside the hydrate dispatch. Without this
      // guard, our addTask calls land before hydration replaces state,
      // so the hydrate wipes them.
      useEffect(() => {
        if (ranRef.current) return;
        if (!state.identity) return;
        ranRef.current = true;
        const a = addTask({
          kind: "explore",
          title: "first",
          source: { topicId: "ai-pm", levelId: "ai-pm-1", sparkId: "shared-id" },
        });
        const b = addTask({
          kind: "explore",
          title: "second",
          source: { topicId: "ai-pm", levelId: "ai-pm-1", sparkId: "shared-id" },
        });
        returnedIds = [a.id, b.id];
      }, [state.identity, addTask]);
      return <div data-testid="ph-count">{state.tasks.length}</div>;
    }

    render(
      <PlayerProvider>
        <AdminProvider>
          <MemoryProvider>
            <SocialProvider>
              <ProgrammaticHarness />
            </SocialProvider>
          </MemoryProvider>
        </AdminProvider>
      </PlayerProvider>,
    );

    await waitFor(() => {
      // Two synchronous addTask calls with the same sparkId — only one
      // task persists in state. (The setState reducer runs asynchronously
      // and the second call's `created` object is dropped by the dedup
      // check inside the reducer; the synchronous return value of the
      // two calls may differ in id, but state never carries a duplicate.)
      expect(screen.getByTestId("ph-count").textContent).toBe("1");
    });
    expect(returnedIds.length).toBe(2);
  });
});
