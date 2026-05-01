import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";

import { PlayerProvider, usePlayer } from "../store/PlayerContext";
import { AdminProvider, useAdmin } from "../admin/AdminContext";
import { Settings } from "../views/Settings";
import { ADMIN_STORAGE_KEY } from "../admin/store";
import { defaultAdminConfig } from "../admin/defaults";
import {
  STORAGE_KEY,
  clearForNewIdentity,
  defaultState,
} from "../store/game";
import { _resetRuntimeCache } from "../admin/runtime";
import * as resetModule from "../store/reset";
import type { AdminConfig, ServerAuthConfig } from "../admin/types";
import type { PlayerState, ServerSessionState } from "../types";

// --- helpers ---------------------------------------------------------------

function writeAdminConfig(patch: Partial<AdminConfig>) {
  const merged: AdminConfig = { ...defaultAdminConfig(), ...patch };
  window.localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(merged));
  _resetRuntimeCache();
}

function writePlayerState(patch: Partial<PlayerState>) {
  const merged: PlayerState = { ...defaultState(), ...patch };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
}

function Providers({ children }: { children: ReactNode }) {
  return (
    <PlayerProvider>
      <AdminProvider>{children}</AdminProvider>
    </PlayerProvider>
  );
}

beforeEach(() => {
  window.localStorage.clear();
  _resetRuntimeCache();
});
afterEach(() => {
  window.localStorage.clear();
  _resetRuntimeCache();
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// 1. SECURITY — cross-account state leak on identity swap
// ---------------------------------------------------------------------------

describe("clearForNewIdentity — pure helper", () => {
  it("wipes profile, xp, streak, badges, progress, history, tasks, feedback", () => {
    const dirty: PlayerState = {
      ...defaultState(),
      identity: { email: "old@gmail.com", provider: "google" },
      profile: {
        name: "Old", ageBand: "adult", skillLevel: "builder",
        interests: [], dailyMinutes: 10, goal: "", experience: "",
        createdAt: 1000,
      },
      xp: 999,
      streak: 7,
      badges: ["b1", "b2"],
      progress: {
        completed: { "ai-builder-l1": ["s-1"] },
        bossPassed: { "ai-builder-l1": true },
        topicXP: { "ai-builder": 99 },
        topicLastTouched: { "ai-builder": 5 },
      },
      history: [
        { ts: 1, topicId: "ai-builder", levelId: "ai-builder-l1", sparkIds: ["s-1"], correct: 1, total: 1, minutes: 1 },
      ],
      tasks: [{
        id: "t-1", kind: "build", title: "x", status: "todo",
        createdAt: 1, updatedAt: 1,
      }],
      feedback: [{ sparkId: "s-1", vote: "down", ts: 1 }],
    };

    const cleared = clearForNewIdentity(dirty);

    expect(cleared.profile).toBeNull();
    expect(cleared.xp).toBe(0);
    expect(cleared.streak).toBe(0);
    expect(cleared.badges).toEqual([]);
    expect(cleared.progress.completed).toEqual({});
    expect(cleared.progress.bossPassed).toEqual({});
    expect(cleared.progress.topicXP).toEqual({});
    expect(cleared.history).toEqual([]);
    expect(cleared.tasks).toEqual([]);
    expect(cleared.feedback).toEqual([]);
  });

  it("preserves per-device fields (apiKey, apiProvider, googleClientId, prefs)", () => {
    const dirty: PlayerState = {
      ...defaultState(),
      apiKey: "sk-test-keep-me",
      apiProvider: "openai",
      googleClientId: "1234.apps.googleusercontent.com",
      prefs: { sound: false, haptics: false, dailyReminderHour: 9 },
      xp: 999,
    };
    const cleared = clearForNewIdentity(dirty);
    expect(cleared.apiKey).toBe("sk-test-keep-me");
    expect(cleared.apiProvider).toBe("openai");
    expect(cleared.googleClientId).toBe("1234.apps.googleusercontent.com");
    expect(cleared.prefs).toEqual({ sound: false, haptics: false, dailyReminderHour: 9 });
    expect(cleared.xp).toBe(0);
  });
});

describe("PlayerContext.signIn — identity swap wipes prior progress", () => {
  it("wipes XP/streak/sparks when a different email signs in on the same device", async () => {
    // Seed localStorage with a prior user's state.
    writePlayerState({
      identity: { email: "prior@gmail.com", provider: "google" },
      xp: 250,
      streak: 5,
      badges: ["first-spark"],
      history: [
        { ts: 1, topicId: "ai-builder", levelId: "ai-builder-l1", sparkIds: ["x"], correct: 1, total: 1, minutes: 1 },
      ],
      apiKey: "sk-keep-me",
    });

    const { result } = renderHook(() => usePlayer(), { wrapper: Providers });

    // Wait for hydrate to land.
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.state.identity?.email).toBe("prior@gmail.com");
    expect(result.current.state.xp).toBe(250);

    // New user signs in on the same device.
    act(() => {
      result.current.signIn({ email: "newcomer@gmail.com", name: "Newcomer" });
    });

    expect(result.current.state.identity?.email).toBe("newcomer@gmail.com");
    expect(result.current.state.xp).toBe(0);
    expect(result.current.state.streak).toBe(0);
    expect(result.current.state.badges).toEqual([]);
    expect(result.current.state.history).toEqual([]);
    // API key is per-device — preserved.
    expect(result.current.state.apiKey).toBe("sk-keep-me");
  });

  it("does NOT wipe state when the SAME user re-signs (e.g. token refresh)", async () => {
    writePlayerState({
      identity: { email: "same@gmail.com", provider: "google" },
      xp: 250,
      streak: 5,
    });

    const { result } = renderHook(() => usePlayer(), { wrapper: Providers });
    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      result.current.signIn({ email: "same@gmail.com", name: "Same Person" });
    });

    expect(result.current.state.xp).toBe(250);
    expect(result.current.state.streak).toBe(5);
  });

  it("signInWithSession also wipes on identity swap", async () => {
    writePlayerState({
      identity: { email: "prior@gmail.com", provider: "google" },
      xp: 999,
    });
    const { result } = renderHook(() => usePlayer(), { wrapper: Providers });
    await act(async () => {
      await Promise.resolve();
    });

    const session: ServerSessionState = {
      token: "jwt-fake",
      email: "newcomer@gmail.com",
      name: "Newcomer",
      isAdmin: false,
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    };

    act(() => {
      result.current.signInWithSession(session);
    });

    expect(result.current.state.identity?.email).toBe("newcomer@gmail.com");
    expect(result.current.state.xp).toBe(0);
    expect(result.current.state.serverSession?.token).toBe("jwt-fake");
  });

  it("identity-swap detection is case-insensitive (Gmail emails are lowercased)", async () => {
    writePlayerState({
      identity: { email: "Same@Gmail.com", provider: "google" },
      xp: 100,
    });
    const { result } = renderHook(() => usePlayer(), { wrapper: Providers });
    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      result.current.signIn({ email: "same@gmail.com", name: "n" });
    });
    expect(result.current.state.xp).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// 2. SECURITY — admin gating in production server-auth mode
// ---------------------------------------------------------------------------

describe("AdminContext.isAdmin — production mode is JWT-only", () => {
  const prodAuth: ServerAuthConfig = {
    mode: "production",
    googleClientId: "x",
    mem0Url: "https://mem0.example.com",
  };
  const demoAuth: ServerAuthConfig = {
    mode: "demo",
    googleClientId: "x",
    mem0Url: "",
  };

  it("production: NO local-allowlist fallback even if user self-bootstrapped", async () => {
    // Attacker scenario: user signed in as alice; locally bootstrapped
    // herself into the admin allowlist. Without a server-signed JWT
    // claim, she must NOT be granted admin.
    writeAdminConfig({
      serverAuth: prodAuth,
      bootstrapped: true,
      admins: ["alice@gmail.com"],
    });
    writePlayerState({
      identity: { email: "alice@gmail.com", provider: "google" },
      // No serverSession — no JWT. The legacy fallback would have
      // returned true here.
    });

    const { result } = renderHook(() => useAdmin(), { wrapper: Providers });
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.isAdmin).toBe(false);
  });

  it("production: JWT `isAdmin: true` grants admin (server is the source of truth)", async () => {
    writeAdminConfig({ serverAuth: prodAuth, admins: [] });
    writePlayerState({
      identity: { email: "ops@example.com", provider: "google" },
      serverSession: {
        token: "jwt",
        email: "ops@example.com",
        isAdmin: true,
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
      },
    });
    const { result } = renderHook(() => useAdmin(), { wrapper: Providers });
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.isAdmin).toBe(true);
  });

  it("production: JWT `isAdmin: false` denies even if email is in local allowlist", async () => {
    writeAdminConfig({
      serverAuth: prodAuth,
      bootstrapped: true,
      admins: ["alice@gmail.com"],
    });
    writePlayerState({
      identity: { email: "alice@gmail.com", provider: "google" },
      serverSession: {
        token: "jwt",
        email: "alice@gmail.com",
        isAdmin: false,
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
      },
    });
    const { result } = renderHook(() => useAdmin(), { wrapper: Providers });
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.isAdmin).toBe(false);
  });

  it("demo: local allowlist still works (forks running without a backend)", async () => {
    writeAdminConfig({
      serverAuth: demoAuth,
      bootstrapped: true,
      admins: ["maker@gmail.com"],
    });
    writePlayerState({
      identity: { email: "maker@gmail.com", provider: "google" },
    });
    const { result } = renderHook(() => useAdmin(), { wrapper: Providers });
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.isAdmin).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. UX — Settings: erase-data is two-click subtle, sign-out navigates home
// ---------------------------------------------------------------------------

describe("Settings — two-click erase + sign-out navigates home", () => {
  beforeEach(() => {
    writePlayerState({
      identity: { email: "user@gmail.com", provider: "google" },
      profile: {
        name: "User", ageBand: "adult", skillLevel: "builder",
        interests: [], dailyMinutes: 10, goal: "", experience: "",
        createdAt: Date.now(),
      },
    });
  });

  function mount(onNav?: (v: { name: string } & Record<string, unknown>) => void) {
    type SettingsOnNav = NonNullable<Parameters<typeof Settings>[0]>["onNav"];
    return render(
      <Providers>
        <Settings onNav={onNav as unknown as SettingsOnNav} />
      </Providers>,
    );
  }

  it("erase button is subtle by default; first click shows 'click again to erase'", async () => {
    mount();
    // wait for hydrate
    await act(async () => {
      await Promise.resolve();
    });
    const initial = screen.getByRole("button", { name: /erase all local data/i });
    expect(initial).toBeTruthy();
    expect(initial.className).toMatch(/text-white\/40/); // muted color
    fireEvent.click(initial);
    expect(screen.getByRole("button", { name: /click again to erase/i })).toBeTruthy();
  });

  it("second click within the window calls eraseAllLocalData()", async () => {
    const eraseSpy = vi.spyOn(resetModule, "eraseAllLocalData").mockImplementation(() => {});
    // Stop location.reload from blowing up jsdom.
    const reloadStub = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      writable: true,
      value: { ...window.location, reload: reloadStub },
    });

    mount();
    await act(async () => {
      await Promise.resolve();
    });
    fireEvent.click(screen.getByRole("button", { name: /erase all local data/i }));
    fireEvent.click(screen.getByRole("button", { name: /click again to erase/i }));

    expect(eraseSpy).toHaveBeenCalledTimes(1);
    expect(reloadStub).toHaveBeenCalledTimes(1);
  });

  it("does NOT use a confirm() popup", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    mount();
    await act(async () => {
      await Promise.resolve();
    });
    fireEvent.click(screen.getByRole("button", { name: /erase all local data/i }));
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it("sign out navigates back to home (not staying on /settings)", async () => {
    const onNav = vi.fn();
    mount(onNav);
    await act(async () => {
      await Promise.resolve();
    });
    fireEvent.click(screen.getByRole("button", { name: /sign out/i }));
    expect(onNav).toHaveBeenCalledWith({ name: "home" });
  });
});

// ---------------------------------------------------------------------------
// 4. UX — Settings: hide bootstrap affordance in production server-auth mode
// ---------------------------------------------------------------------------

describe("Settings — admin bootstrap affordance gating", () => {
  function mount() {
    return render(
      <Providers>
        <Settings />
      </Providers>,
    );
  }

  it("production mode: NO 'Bootstrap me as admin' button is rendered", async () => {
    writeAdminConfig({
      serverAuth: { mode: "production", googleClientId: "x", mem0Url: "https://x" },
      bootstrapped: false,
      admins: [],
    });
    writePlayerState({
      identity: { email: "newuser@gmail.com", provider: "google" },
    });
    mount();
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.queryByRole("button", { name: /bootstrap me as admin/i })).toBeNull();
    // And we explain why.
    expect(screen.getByText(/managed server-side on this deployment/i)).toBeTruthy();
  });

  it("demo mode + no admin yet: 'Bootstrap me as admin' IS available (fork friendly)", async () => {
    writeAdminConfig({
      serverAuth: { mode: "demo", googleClientId: "x", mem0Url: "" },
      bootstrapped: false,
      admins: [],
    });
    writePlayerState({
      identity: { email: "maker@gmail.com", provider: "google" },
    });
    mount();
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByRole("button", { name: /bootstrap me as admin/i })).toBeTruthy();
  });
});
