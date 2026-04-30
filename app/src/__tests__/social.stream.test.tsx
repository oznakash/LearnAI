import { describe, it, expect, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PlayerProvider } from "../store/PlayerContext";
import { AdminProvider } from "../admin/AdminContext";
import { MemoryProvider } from "../memory/MemoryContext";
import { SocialProvider } from "../social/SocialContext";
import { SparkStream } from "../views/SparkStream";
import { TabBar } from "../components/TabBar";
import { ADMIN_STORAGE_KEY } from "../admin/store";
import { STORAGE_KEY } from "../store/game";

function mountStream() {
  return render(
    <PlayerProvider>
      <AdminProvider>
        <MemoryProvider>
          <SocialProvider>
            <SparkStream onNav={() => {}} />
          </SocialProvider>
        </MemoryProvider>
      </AdminProvider>
    </PlayerProvider>,
  );
}

function mountTabBar(view: React.ComponentProps<typeof TabBar>["view"]) {
  return render(
    <PlayerProvider>
      <AdminProvider>
        <MemoryProvider>
          <SocialProvider>
            <TabBar view={view} onNav={() => {}} />
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
        name: "Maya",
        ageBand: "adult",
        skillLevel: "builder",
        interests: [],
        dailyMinutes: 10,
        goal: "",
        experience: "",
        createdAt: Date.now(),
      },
    }),
  );
});

describe("Spark Stream view", () => {
  it("renders the header + filter chips + refresh", async () => {
    mountStream();
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /^Spark Stream$/ })).toBeTruthy();
    });
    expect(screen.getByRole("button", { name: /🌊 All/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /✓ Only people I follow/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /↻ Refresh/ })).toBeTruthy();
  });

  it("falls back to mock cards when getStream returns []", async () => {
    mountStream();
    // Mock cards include "sample" tags.
    await waitFor(() => {
      expect(screen.getAllByText(/sample/i).length).toBeGreaterThan(0);
    });
    // Specific mock authors appear (≥1 occurrence each — Ada has 2 cards).
    await waitFor(() => {
      expect(screen.getAllByText("Ada").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Priya").length).toBeGreaterThan(0);
    });
  });

  it("'Only people I follow' filter shows the empty-state when player follows nobody", async () => {
    mountStream();
    await waitFor(() => screen.getByRole("button", { name: /✓ Only people I follow/ }));
    fireEvent.click(screen.getByRole("button", { name: /✓ Only people I follow/ }));
    await waitFor(() => {
      expect(screen.getByText(/No fresh activity from your follows/i)).toBeTruthy();
    });
  });

  it("renders headline copy for each card kind", async () => {
    mountStream();
    await waitFor(() => {
      expect(screen.getAllByText(/sample/i).length).toBeGreaterThan(0);
    });
    // level_up (multiple cards)
    expect(screen.getAllByText(/reached Level/i).length).toBeGreaterThan(0);
    // boss_beaten — score format
    expect(screen.getAllByText(/beat the .* Boss/i).length).toBeGreaterThan(0);
    // streak_milestone
    expect(screen.getAllByText(/-day streak/i).length).toBeGreaterThan(0);
    // spotlight
    expect(screen.getAllByText(/top mover this week/i).length).toBeGreaterThan(0);
  });
});

describe("TabBar respects social + stream flags", () => {
  it("shows 4 tabs when social+stream are off (default)", async () => {
    mountTabBar({ name: "home" });
    await waitFor(() => {
      // Home / Tasks / Progress / Boards — no Stream.
      expect(screen.queryByRole("button", { name: /Stream/i })).toBeNull();
    });
    expect(screen.getByRole("button", { name: /Boards/ })).toBeTruthy();
  });

  it("shows the Stream tab when both flags are on", async () => {
    // Flip flags.
    const cfg = JSON.parse(localStorage.getItem(ADMIN_STORAGE_KEY) ?? "{}");
    cfg.flags = { ...(cfg.flags ?? {}), socialEnabled: true, streamEnabled: true };
    localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(cfg));

    mountTabBar({ name: "home" });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Stream/ })).toBeTruthy();
    });
  });
});
