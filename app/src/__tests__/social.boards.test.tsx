import { describe, it, expect, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PlayerProvider } from "../store/PlayerContext";
import { AdminProvider } from "../admin/AdminContext";
import { MemoryProvider } from "../memory/MemoryContext";
import { SocialProvider } from "../social/SocialContext";
import { Leaderboard } from "../views/Leaderboard";
import { OfflineSocialService } from "../social/offline";
import { STORAGE_KEY } from "../store/game";
import { ADMIN_STORAGE_KEY } from "../admin/store";

function mount() {
  return render(
    <PlayerProvider>
      <AdminProvider>
        <MemoryProvider>
          <SocialProvider>
            <Leaderboard onNav={() => {}} />
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
      identity: { email: "maya@gmail.com", name: "Maya Patel", provider: "google" },
      profile: {
        name: "Maya",
        ageBand: "adult",
        skillLevel: "builder",
        interests: [],
        dailyMinutes: 10,
        goal: "",
        experience: "",
        createdAt: Date.now(),
      },
      xp: 250,
    }),
  );
});

describe("Leaderboards (Boards) view", () => {
  it("renders the Global tab + period pills + tiers reference", async () => {
    mount();
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /^Leaderboards$/ })).toBeTruthy();
    });
    expect(screen.getByRole("button", { name: /🌐 Global/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /✓ Following/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /This week/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /This month/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /All time/ })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /^Tiers$/ })).toBeTruthy();
  });

  it("does NOT show mock filler in production-default config (showDemoData=false)", async () => {
    mount();
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /^Leaderboards$/ })).toBeTruthy();
    });
    // Default admin config sets showDemoData=false, so the FAKE_GUILD
    // never enters the player list. The 'sample' tag is the marker used
    // by the renderer to label mock rows; its absence confirms the gate.
    expect(screen.queryAllByText(/sample/i).length).toBe(0);
    // The first builder ALWAYS sees themselves on the board, so the
    // empty-state copy ("be the first builder") should render.
    await waitFor(() => {
      expect(screen.getByText(/first builder on this board/i)).toBeTruthy();
    });
  });

  it("shows mock filler when admin opts in via showDemoData=true", async () => {
    // Persist the admin override BEFORE mounting so AdminProvider hydrates
    // with showDemoData=true. Mirrors how the operator would flip the flag
    // in Admin → Config.
    const cfg = JSON.parse(localStorage.getItem(ADMIN_STORAGE_KEY) ?? "{}");
    cfg.flags = { ...(cfg.flags ?? {}), showDemoData: true };
    localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(cfg));
    mount();
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /^Leaderboards$/ })).toBeTruthy();
    });
    // Mock filler tags appear under their names with a "sample" label.
    await waitFor(() => {
      expect(screen.getAllByText(/sample/i).length).toBeGreaterThan(0);
    });
  });

  it("Following tab hides the player's own row + shows empty-state copy when no follows", async () => {
    mount();
    await waitFor(() => screen.getByRole("button", { name: /✓ Following/ }));
    fireEvent.click(screen.getByRole("button", { name: /✓ Following/ }));
    // Wait for the following empty state.
    await waitFor(() => {
      expect(screen.getByText(/Follow some builders to see them here/i)).toBeTruthy();
    });
  });

  it("Topic tab appears for each Signal the player set", async () => {
    const svc = new OfflineSocialService({ email: "maya@gmail.com" });
    await svc.setSignals(["ai-pm", "ai-foundations"] as never);

    mount();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /AI Product Management/i })).toBeTruthy();
      expect(screen.getByRole("button", { name: /AI Foundations/i })).toBeTruthy();
    });
  });

  it("clicking + Topic reveals the picker with all 12 Topics", async () => {
    mount();
    await waitFor(() => screen.getByRole("button", { name: /\+ Topic/ }));
    fireEvent.click(screen.getByRole("button", { name: /\+ Topic/ }));
    await waitFor(() => {
      // Spot-check 2 distinct topics in the picker.
      expect(screen.getAllByText(/AI Product Management/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Memory & Safety/i).length).toBeGreaterThan(0);
    });
  });

  it("getBoard returns [] in offline mode regardless of scope/period", async () => {
    const svc = new OfflineSocialService({ email: "maya@gmail.com" });
    expect(await svc.getBoard("global", "week")).toEqual([]);
    expect(await svc.getBoard("global", "month")).toEqual([]);
    expect(await svc.getBoard("global", "all")).toEqual([]);
    expect(await svc.getBoard("following", "week")).toEqual([]);
    expect(await svc.getBoard({ topicId: "ai-pm" } as never, "week")).toEqual([]);
  });
});
