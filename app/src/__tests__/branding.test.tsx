import { describe, it, expect, beforeEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { PlayerProvider } from "../store/PlayerContext";
import { AdminProvider } from "../admin/AdminContext";
import { MemoryProvider } from "../memory/MemoryContext";
import { TopBar } from "../components/TopBar";
import { ADMIN_STORAGE_KEY } from "../admin/store";
import { STORAGE_KEY } from "../store/game";

/**
 * Regression test for the "branding doesn't propagate" bug.
 *
 * The admin can change appName / tagline / logoEmoji / accentColor /
 * accent2Color in /admin → Branding. Every UI surface that displays the
 * brand (TopBar, Onboarding header, SignIn header, Memory copy, etc.)
 * must read from `useAdmin().config.branding`, not from hardcoded strings.
 *
 * This file proves it for the most prominent surface — TopBar, which
 * persists across every signed-in screen. If branding ever silently goes
 * stale here, this test fails before the user sees it.
 */
function mountTopBar() {
  // PlayerState identity required so TopBar renders the avatar block.
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
          <TopBar onNav={() => {}} />
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

describe("TopBar honors admin branding (no hardcoded BuilderQuest/BQ)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("shows the default brand (LearnAI / AI) when admin config is fresh", async () => {
    mountTopBar();
    await settle();
    expect(screen.getByText("LearnAI")).toBeTruthy();
    expect(screen.getByText("AI")).toBeTruthy();
  });

  it("shows the admin-configured app name + tagline + logoEmoji", async () => {
    localStorage.setItem(
      ADMIN_STORAGE_KEY,
      JSON.stringify({
        branding: {
          appName: "AcmeLearn",
          tagline: "Stay sharp.",
          logoEmoji: "AL",
          accentColor: "#7c5cff",
          accent2Color: "#28e0b3",
        },
      })
    );
    mountTopBar();
    await settle();
    expect(screen.getByText("AcmeLearn")).toBeTruthy();
    expect(screen.getByText("Stay sharp.")).toBeTruthy();
    expect(screen.getByText("AL")).toBeTruthy();
  });

  it("does not leak the legacy BuilderQuest / BQ defaults", async () => {
    mountTopBar();
    await settle();
    expect(screen.queryByText("BuilderQuest")).toBeNull();
    // "BQ" might appear inside an attribute or longer string — check it's
    // not the visible 2-letter logo, which would be its own text node.
    expect(screen.queryByText(/^BQ$/)).toBeNull();
  });
});

describe("TopBar avatar tap routes to the unified profile editor", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // The avatar is the highest-affinity "this is me" surface in the shell.
  // Tapping it should land on the profile editor (`/network`) when social
  // is enabled — not the operational Settings dump. See `docs/profile.md`
  // §3.
  it("with social enabled, avatar tap navigates to /network", async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        identity: { email: "alex@gmail.com", name: "Alex", provider: "google" },
      }),
    );
    localStorage.setItem(
      ADMIN_STORAGE_KEY,
      JSON.stringify({ flags: { socialEnabled: true } }),
    );
    let target: { name: string } | null = null;
    render(
      <PlayerProvider>
        <AdminProvider>
          <MemoryProvider>
            <TopBar onNav={(v) => { target = v as { name: string }; }} />
          </MemoryProvider>
        </AdminProvider>
      </PlayerProvider>,
    );
    await settle();
    const avatarButton = screen.getByRole("button", { name: /Open my profile/i });
    fireEvent.click(avatarButton);
    expect(target).not.toBeNull();
    expect(target!.name).toBe("network");
  });

  // Fallback: if the operator has social off, there's nowhere to go but
  // Settings. Don't strand the user.
  it("with social disabled, avatar tap falls back to /settings", async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        identity: { email: "alex@gmail.com", name: "Alex", provider: "google" },
      }),
    );
    localStorage.setItem(
      ADMIN_STORAGE_KEY,
      JSON.stringify({ flags: { socialEnabled: false } }),
    );
    let target: { name: string } | null = null;
    render(
      <PlayerProvider>
        <AdminProvider>
          <MemoryProvider>
            <TopBar onNav={(v) => { target = v as { name: string }; }} />
          </MemoryProvider>
        </AdminProvider>
      </PlayerProvider>,
    );
    await settle();
    const avatarButton = screen.getByRole("button", { name: /Open my profile/i });
    fireEvent.click(avatarButton);
    expect(target).not.toBeNull();
    expect(target!.name).toBe("settings");
  });
});
