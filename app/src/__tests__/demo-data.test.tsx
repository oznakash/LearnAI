import { describe, it, expect, beforeEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { PlayerProvider } from "../store/PlayerContext";
import { AdminProvider, useAdmin } from "../admin/AdminContext";
import { ADMIN_STORAGE_KEY } from "../admin/store";
import { STORAGE_KEY } from "../store/game";

/**
 * The admin "Show demo data" toggle determines whether the deterministic
 * 30-user mock cohort is folded into mockUsers (the source for Users +
 * Analytics + every other admin surface). The default is **off** so a
 * production deployment doesn't surface fake people; flipping it on is
 * a one-click way to populate the UI for demos and screenshots.
 */
function MockUsersProbe() {
  const { mockUsers, config, setConfig } = useAdmin();
  return (
    <div>
      <span data-testid="count">{mockUsers.length}</span>
      <span data-testid="flag">{String(config.flags.showDemoData)}</span>
      <button
        data-testid="toggle"
        onClick={() =>
          setConfig((cfg) => ({
            ...cfg,
            flags: { ...cfg.flags, showDemoData: !cfg.flags.showDemoData },
          }))
        }
      >
        toggle
      </button>
    </div>
  );
}

function mount() {
  return render(
    <PlayerProvider>
      <AdminProvider>
        <MockUsersProbe />
      </AdminProvider>
    </PlayerProvider>
  );
}

async function settle() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

describe("Admin → Demo data toggle gates the mock cohort everywhere", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("default (no admin config) hides the demo cohort", async () => {
    mount();
    await settle();
    expect(screen.getByTestId("flag").textContent).toBe("false");
    // 0 mockUsers when no real player signed in either; the demo cohort
    // would have been ~30. Either 0 or 1 is fine — the point is "not 30".
    const count = Number(screen.getByTestId("count").textContent);
    expect(count).toBeLessThanOrEqual(1);
  });

  it("flag explicitly off (admin config saved): zero or one user", async () => {
    localStorage.setItem(
      ADMIN_STORAGE_KEY,
      JSON.stringify({ flags: { showDemoData: false } })
    );
    mount();
    await settle();
    const count = Number(screen.getByTestId("count").textContent);
    expect(count).toBeLessThanOrEqual(1);
  });

  it("flag on: demo cohort is folded in (≥ 20 users)", async () => {
    localStorage.setItem(
      ADMIN_STORAGE_KEY,
      JSON.stringify({ flags: { showDemoData: true } })
    );
    mount();
    await settle();
    const count = Number(screen.getByTestId("count").textContent);
    expect(count).toBeGreaterThan(20);
  });

  it("flag on + signed-in user: cohort + you (≥ 21)", async () => {
    localStorage.setItem(
      ADMIN_STORAGE_KEY,
      JSON.stringify({ flags: { showDemoData: true } })
    );
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        identity: { email: "alex@gmail.com", name: "Alex", provider: "google" },
      })
    );
    mount();
    await settle();
    const count = Number(screen.getByTestId("count").textContent);
    expect(count).toBeGreaterThan(20);
  });

  it("flag off + signed-in user: only you (1 user)", async () => {
    localStorage.setItem(
      ADMIN_STORAGE_KEY,
      JSON.stringify({ flags: { showDemoData: false } })
    );
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        identity: { email: "alex@gmail.com", name: "Alex", provider: "google" },
      })
    );
    mount();
    await settle();
    expect(screen.getByTestId("count").textContent).toBe("1");
  });

  // Regression: the cohort-build effect used to omit `showDemoData` from
  // its dep array, so flipping the flag in the Config tab didn't refresh
  // the Users / Analytics tables until something else nudged a re-render.
  // Make sure a toggle is observed immediately.
  it("toggling the flag at runtime updates mockUsers immediately", async () => {
    mount();
    await settle();
    expect(screen.getByTestId("flag").textContent).toBe("false");
    const before = Number(screen.getByTestId("count").textContent);
    expect(before).toBeLessThanOrEqual(1);

    await act(async () => {
      screen.getByTestId("toggle").click();
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(screen.getByTestId("flag").textContent).toBe("true");
    const after = Number(screen.getByTestId("count").textContent);
    expect(after).toBeGreaterThan(20);
  });
});
