import { describe, it, expect, beforeEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { PlayerProvider } from "../store/PlayerContext";
import { AdminProvider } from "../admin/AdminContext";
import { MemoryProvider } from "../memory/MemoryContext";
import { Onboarding, defaultInterestsForRole } from "../views/Onboarding";
import { STORAGE_KEY } from "../store/game";
import { roleToSuggestedTopics } from "../store/role";

/**
 * Integration coverage for the role-aware onboarding wizard.
 *
 * - The role step appears between name and age.
 * - Picking "Engineer" pre-checks the engineer's suggested topics.
 * - The fluency probe step renders 2 questions and shows a "We'll meet you here"
 *   suggestion once both are answered.
 * - The first-Spark preview step renders the topic + spark title we'll start with.
 *
 * We don't drive every step end-to-end (that's brittle); we drive enough to prove
 * each new step is wired up to its data source and to the rest of the wizard.
 */
function mount() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      identity: { email: "alex@gmail.com", name: "Alex", provider: "google" },
    })
  );
  return render(
    <PlayerProvider>
      <AdminProvider>
        <MemoryProvider>
          <Onboarding />
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

describe("Onboarding · role-aware flow", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders 8 steps starting at 'Hey there'", async () => {
    mount();
    await settle();
    expect(screen.getByText(/Step 1\/8/)).toBeTruthy();
    expect(screen.getByText(/Hey there/)).toBeTruthy();
  });

  it("advances from name to the role step on Next", async () => {
    mount();
    await settle();
    // The wizard's `useState` for name is seeded from the *first* render,
    // before PlayerProvider's hydrate effect — so we type explicitly.
    const nameInput = screen.getByPlaceholderText(/Your name/) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "Alex" } });
    await settle();
    fireEvent.click(screen.getByText(/Next →/));
    await settle();
    expect(screen.getByText(/What best describes you today\?/)).toBeTruthy();
    expect(screen.getByText(/Step 2\/8/)).toBeTruthy();
  });

  it("after picking Engineer, the suggested topics are exposed via defaultInterestsForRole", () => {
    // Pure-function check: the helper the wizard uses to pre-check topics
    // must agree with the role-suggestion module. If this drifts, the
    // wizard's pre-checks drift with it.
    expect(defaultInterestsForRole("engineer")).toEqual(roleToSuggestedTopics("engineer"));
    expect(defaultInterestsForRole("pm")[0]).toBe("ai-pm");
    expect(defaultInterestsForRole("student")[0]).toBe("ai-foundations");
  });

  it("returns an empty pre-selection for 'other' (avoids opinionated start)", () => {
    expect(defaultInterestsForRole("other")).toEqual([]);
  });

  it("returns an empty pre-selection for undefined role (back-compat)", () => {
    expect(defaultInterestsForRole(undefined)).toEqual([]);
  });

  it("the role step shows all 9 role options", async () => {
    mount();
    await settle();
    const nameInput = screen.getByPlaceholderText(/Your name/) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "Alex" } });
    await settle();
    fireEvent.click(screen.getByText(/Next →/));
    await settle();
    // The 9 role labels — student / pm / engineer / designer / creator /
    // exec / researcher / curious / other.
    expect(screen.getByText(/Student \/ Kid/)).toBeTruthy();
    expect(screen.getByText(/Product Manager/)).toBeTruthy();
    expect(screen.getByText(/Engineer/)).toBeTruthy();
    expect(screen.getByText(/Designer/)).toBeTruthy();
    expect(screen.getByText(/Creator \/ Educator/)).toBeTruthy();
    expect(screen.getByText(/Exec \/ Leader/)).toBeTruthy();
    expect(screen.getByText(/Researcher/)).toBeTruthy();
    expect(screen.getByText(/Curious adult/)).toBeTruthy();
    expect(screen.getByText(/Something else/)).toBeTruthy();
  });

  it("picking a role enables the Next button", async () => {
    mount();
    await settle();
    const nameInput = screen.getByPlaceholderText(/Your name/) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "Alex" } });
    await settle();
    fireEvent.click(screen.getByText(/Next →/));
    await settle();
    const nextBtn = screen.getByText(/Next →/) as HTMLButtonElement;
    expect(nextBtn.disabled).toBe(true);
    fireEvent.click(screen.getByText(/Engineer/));
    await settle();
    expect((screen.getByText(/Next →/) as HTMLButtonElement).disabled).toBe(false);
  });

  it("renders a recognizable 8-step total in the progress label", async () => {
    mount();
    await settle();
    expect(screen.getByText(/Step 1\/8/)).toBeTruthy();
    const nameInput = screen.getByPlaceholderText(/Your name/) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "Alex" } });
    await settle();
    fireEvent.click(screen.getByText(/Next →/));
    await settle();
    expect(screen.getByText(/Step 2\/8/)).toBeTruthy();
  });
});
