import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { PlayerProvider } from "../store/PlayerContext";
import { AdminProvider } from "../admin/AdminContext";
import { MemoryProvider } from "../memory/MemoryContext";
import { SocialProvider } from "../social/SocialContext";
import { Memory } from "../views/Memory";
import { STORAGE_KEY } from "../store/game";

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

function mount() {
  return render(
    <PlayerProvider>
      <AdminProvider>
        <MemoryProvider>
          <SocialProvider>
            <Memory onExit={() => {}} />
          </SocialProvider>
        </MemoryProvider>
      </AdminProvider>
    </PlayerProvider>,
  );
}

describe("Memory view (player) — read + forget + wipe only", () => {
  it("does NOT render an Edit button on memory rows or an Export button in the header", async () => {
    mount();
    await waitFor(() => screen.getByRole("heading", { name: /Your Memory/i }));
    expect(screen.queryByRole("button", { name: /^Edit$/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /Export/i })).toBeNull();
  });

  it("still renders the Wipe everything button (player can always remove)", async () => {
    mount();
    await waitFor(() => screen.getByRole("heading", { name: /Your Memory/i }));
    expect(screen.getByRole("button", { name: /Wipe everything/i })).toBeTruthy();
  });

  it("header copy reflects the new contract (no mention of edit/export)", async () => {
    mount();
    await waitFor(() => screen.getByRole("heading", { name: /Your Memory/i }));
    const para = screen.getByText(/Forget anything you don't want kept/i);
    expect(para.textContent ?? "").not.toMatch(/edit/i);
    expect(para.textContent ?? "").not.toMatch(/export/i);
  });
});
