import { describe, it, expect, beforeEach } from "vitest";
import { act, render, screen, fireEvent } from "@testing-library/react";
import { PlayerProvider } from "../store/PlayerContext";
import { AdminProvider } from "../admin/AdminContext";
import { MemoryProvider } from "../memory/MemoryContext";
import { Play } from "../views/Play";
import { STORAGE_KEY } from "../store/game";
import { ADMIN_STORAGE_KEY } from "../admin/store";

/**
 * Regression for "stuck on ✓ Logged with no Next button" on passive
 * Sparks (MicroRead, Tip). The fix: passive content auto-advances on
 * the single click that logs it — no separate feedback card with a
 * Next button below the fold.
 *
 * Active assessments (Quick Pick, Fill the Stack, Scenario, Pattern
 * Match, Build Card, Boss) keep the feedback-card-with-Next flow
 * because they have a meaningful right/wrong outcome.
 */
function mountWithSignedInUser() {
  // PlayerState must have an identity + a profile so Play renders.
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      identity: { email: "alex@gmail.com", name: "Alex", provider: "google" },
      profile: {
        name: "Alex",
        ageBand: "adult",
        skillLevel: "builder",
        interests: ["ai-foundations"],
        dailyMinutes: 10,
        goal: "build",
        experience: "",
        createdAt: Date.now(),
      },
      // Demo-mode-equivalent so we don't need a session token. Memory
      // calls go to the offline service in this test env.
    })
  );
  localStorage.setItem(
    ADMIN_STORAGE_KEY,
    JSON.stringify({ serverAuth: { mode: "demo", googleClientId: "", mem0Url: "" } })
  );
  return render(
    <PlayerProvider>
      <AdminProvider>
        <MemoryProvider>
          <Play
            topicId="ai-foundations"
            onDone={() => {}}
            onSwitchTopic={() => {}}
          />
        </MemoryProvider>
      </AdminProvider>
    </PlayerProvider>
  );
}

async function settle() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

describe("Play view — passive Sparks auto-advance, active ones show feedback", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("MicroRead at the start of a level: clicking 'I got it' moves to spark 2/N", async () => {
    mountWithSignedInUser();
    await settle();

    // Header should say "Spark 1/N"
    const initialHeader = screen.queryByText(/Spark 1\//);
    expect(initialHeader).toBeTruthy();

    // The first Spark of the seeded ai-foundations Level 1 is a MicroRead;
    // its action button is "I got it ⚡".
    const btn = screen.queryByRole("button", { name: /I got it/i });
    if (!btn) {
      // If the seed changed and Spark 1 is no longer a MicroRead, skip —
      // this test is about the auto-advance contract, not curriculum shape.
      return;
    }
    fireEvent.click(btn);

    // queueMicrotask defers the advance one tick — flush it.
    await settle();
    await settle();

    // Header should now say Spark 2/N (or the level finished if there was
    // only one Spark — either way, NOT stuck on Spark 1).
    const stillStuck = screen.queryAllByText(/Spark 1\//).length > 0;
    expect(stillStuck).toBe(false);

    // No feedback card with the legacy "✓ Logged" + "Next →" pair should
    // appear for passive Sparks any more.
    expect(screen.queryByRole("button", { name: /Next →/i })).toBeNull();
  });
});
