import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, waitFor, cleanup } from "@testing-library/react";
import { PlayerProvider } from "../store/PlayerContext";
import { AdminProvider } from "../admin/AdminContext";
import { MemoryProvider } from "../memory/MemoryContext";
import { SocialProvider, useSocial } from "../social/SocialContext";
import { OfflineSocialService } from "../social/offline";
import { STORAGE_KEY } from "../store/game";

/**
 * Bug A regression — entity-wiring audit (2026-05-04).
 *
 * Symptom: mem0 had 12 users; social-svc only had 2 profiles. The
 * leaderboard looked empty because real users existed cognition-side
 * but never got auto-created social-side. Root cause: SocialContext's
 * identity-sync useEffect only ever called `updateProfile()` — and
 * only when the identity carried a `name` or `picture`. Mem0 users
 * who registered via email+password (no name claim) made it through
 * the SPA without ever touching social-svc, so `requireUser` never
 * lazy-created their profile.
 *
 * Fix: a parallel `ensureProfile` step that fires `getMyProfile()`
 * once per signed-in email, no matter what the identity object
 * contains. This pins the contract.
 */

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function seedIdentity(identity: { email: string; name?: string; picture?: string }) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      identity: { ...identity, provider: "google" as const },
    }),
  );
}

function ServiceProbe() {
  // Keeps SocialProvider mounted so its useEffects fire — no DOM output needed.
  useSocial();
  return null;
}

function mountWithProviders() {
  return render(
    <PlayerProvider>
      <AdminProvider>
        <MemoryProvider>
          <SocialProvider>
            <ServiceProbe />
          </SocialProvider>
        </MemoryProvider>
      </AdminProvider>
    </PlayerProvider>,
  );
}

describe("SocialContext ensureProfile (Bug A regression)", () => {
  it("calls getMyProfile() at least once on signin even when identity has NO name/picture", async () => {
    seedIdentity({ email: "nakedidentity@gmail.com" });
    const ensureSpy = vi.spyOn(OfflineSocialService.prototype, "getMyProfile");
    const updateSpy = vi.spyOn(OfflineSocialService.prototype, "updateProfile");
    mountWithProviders();
    await waitFor(() => {
      expect(ensureSpy).toHaveBeenCalled();
    });
    // updateProfile must NOT fire when patch is empty — preserves the
    // prior contract for the name/picture path.
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("fires both getMyProfile() AND updateProfile() when identity has name + picture", async () => {
    seedIdentity({
      email: "maya@gmail.com",
      name: "Maya Patel",
      picture: "https://lh3.googleusercontent.com/maya/photo.jpg",
    });
    const ensureSpy = vi.spyOn(OfflineSocialService.prototype, "getMyProfile");
    const updateSpy = vi.spyOn(OfflineSocialService.prototype, "updateProfile");
    mountWithProviders();
    await waitFor(() => {
      expect(ensureSpy).toHaveBeenCalled();
      expect(updateSpy).toHaveBeenCalled();
    });
  });
});
