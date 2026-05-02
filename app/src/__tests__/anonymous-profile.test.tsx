import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import App from "../App";
import { STORAGE_KEY } from "../store/game";
import { OfflineSocialService } from "../social/offline";

/**
 * Regression: a visitor who lands on `/u/<handle>` without being signed
 * in must NOT bounce to the sign-in screen. The public profile is the
 * one route every other surface points at — share links, leaderboard
 * "view profile" CTAs, recruiter drive-bys, and (most importantly)
 * crawler / unfurl bots.
 *
 * Pre-fix behavior: `App.tsx` had `if (!state.identity) return <SignIn />`
 * before the view switch, so every anonymous visit to `/u/oznakash`
 * landed on the sign-in card. This file pins the new contract.
 *
 * Note: the cold-load path (an actual browser GET to `/u/<handle>`) is
 * served by social-svc directly — the SSR test in
 * `services/social-svc/__tests__/ssr.test.ts` covers that surface. THIS
 * file covers the SPA-internal case: a signed-in user signs out while
 * parked on a profile, or any future SPA navigation that lands on
 * `/u/<handle>` without identity.
 */

function setLocation(pathname: string) {
  // jsdom supports window.history.replaceState for path manipulation.
  window.history.replaceState({}, "", pathname);
}

beforeEach(() => {
  localStorage.clear();
  setLocation("/");
});

async function settle() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 10));
  });
}

describe("Anonymous /u/<handle> route — does not redirect to sign-in", () => {
  it("renders the Profile view (not <SignIn />) when there is no identity", async () => {
    setLocation("/u/maya");
    render(<App />);
    await settle();
    // The sign-in flow uses "Sign in to start" as the H2 + a "Continue
    // with Google" button. Neither should appear on an anonymous /u/<>.
    expect(screen.queryByRole("heading", { name: /Sign in to start/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /Continue with Google/i })).toBeNull();
    // The Profile view's loading-then-not-found path renders "@maya"
    // either in the loading header or the not-found card.
    await waitFor(() => {
      const found = document.body.textContent?.includes("@maya");
      expect(found).toBe(true);
    });
  });

  it("shows the anonymous header (Sign in CTA) instead of the signed-in TopBar", async () => {
    setLocation("/u/somebody");
    render(<App />);
    await settle();
    // Anonymous header has a literal "Sign in to start" CTA pointing at
    // home. The signed-in TopBar shows XP / streak / focus pills, none
    // of which are meaningful without identity.
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Sign in to start/i })).toBeTruthy();
    });
    // No XP / streak / focus pills (those are TopBar-only).
    expect(document.body.textContent).not.toMatch(/⚡\s*\d+/);
  });

  it("renders the signed-in profile (with TopBar) when identity is present", async () => {
    // Sanity: the auth-gate change is gated on `view.name === "profile"`
    // — when a signed-in user navigates to a profile, the normal
    // signed-in shell still applies (TopBar with XP / streak pills).
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
        xp: 740,
      }),
    );
    // Seed a public profile so getProfile can resolve.
    const svc = new OfflineSocialService({ email: "maya@gmail.com" });
    await svc.updateProfile({ profileMode: "open", showFullName: true });

    setLocation("/u/maya");
    render(<App />);
    await settle();
    // The signed-in TopBar shows the XP pill.
    await waitFor(() => {
      expect(document.body.textContent).toMatch(/⚡\s*740/);
    });
    // The anonymous "Sign in to start" CTA must NOT appear when signed in.
    expect(screen.queryByRole("button", { name: /Sign in to start/i })).toBeNull();
  });

  it("non-profile routes still require sign-in (the gate didn't open everywhere)", async () => {
    // Pin: the gate change applies ONLY to the profile route. /home,
    // /play, /settings, etc. still redirect to sign-in for anonymous users.
    setLocation("/home");
    render(<App />);
    await settle();
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Sign in to start/i })).toBeTruthy();
    });
  });
});
