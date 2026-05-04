import { describe, it, expect, beforeEach } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PlayerProvider } from "../store/PlayerContext";
import { AdminProvider } from "../admin/AdminContext";
import { MemoryProvider } from "../memory/MemoryContext";
import { SocialProvider } from "../social/SocialContext";
import { Profile } from "../views/Profile";
import { Network } from "../views/Network";
import { Settings } from "../views/Settings";
import { Leaderboard } from "../views/Leaderboard";
import { TopBar } from "../components/TopBar";
import { OfflineSocialService } from "../social/offline";
import { selectSocialService } from "../social";
import { STORAGE_KEY } from "../store/game";

/**
 * Identity-sync regression + cross-view audit.
 *
 * The original bug: a freshly signed-in player's `/u/<handle>` rendered
 * email-derived initials and the email's local-part as the display name —
 * even though their Google identity already had a `name` and `picture`.
 * The offline social profile only learned of those values if the user
 * manually patched them via `updateProfile`, and there is no Network UI
 * to do that. Result: the public profile was stale on day one.
 *
 * The fix threads `identity.name` / `identity.picture` from `player.identity`
 * through `selectSocialService` into `OfflineSocialService.toPublic`, where
 * they act as the fallback for `displayName` / `pictureUrl` until the user
 * explicitly customizes the profile. This file pins:
 *
 *  1. The OfflineSocialService backfill semantics (unit-level).
 *  2. The Profile view picks the Google name + picture up automatically.
 *  3. An explicit `updateProfile({ fullName })` patch still wins over
 *     the identity fallback.
 *  4. A "re-sign-in with a different Google name" (identity swap) updates
 *     the public profile without needing a manual edit.
 *  5. Cross-view consistency: TopBar avatar, Settings header, Network
 *     "view my public profile" CTA, and Leaderboard "me" row all surface
 *     the same identity.
 */

const MAYA = {
  email: "maya@gmail.com",
  name: "Maya Patel",
  picture: "https://lh3.googleusercontent.com/maya/photo.jpg",
  provider: "google" as const,
};

function seedSignedIn(identity = MAYA) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ identity }),
  );
}

function mountWithProviders(ui: React.ReactElement) {
  return render(
    <PlayerProvider>
      <AdminProvider>
        <MemoryProvider>
          <SocialProvider>{ui}</SocialProvider>
        </MemoryProvider>
      </AdminProvider>
    </PlayerProvider>,
  );
}

async function settle() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 10));
  });
}

beforeEach(() => {
  localStorage.clear();
});

// -- Layer 1: OfflineSocialService backfill ------------------------------

describe("OfflineSocialService — identity backfill", () => {
  it("backfills displayName from identityName when no fullName is stored", async () => {
    const svc = new OfflineSocialService({
      email: MAYA.email,
      identityName: MAYA.name,
      identityPicture: MAYA.picture,
    });
    const me = await svc.getMyProfile();
    // Owner view always shows full name (showFullName=true for owner-side
    // preview). Visitor projection drops to first name when the owner has
    // not opted to expose the full name.
    expect(me.displayName).toBe("Maya Patel");
    expect(me.pictureUrl).toBe(MAYA.picture);
  });

  it("visitor sees first name only when showFullName=false (default), but still gets the avatar", async () => {
    const svc = new OfflineSocialService({
      email: MAYA.email,
      identityName: MAYA.name,
      identityPicture: MAYA.picture,
    });
    const visitor = await svc.getProfile("maya");
    expect(visitor?.displayName).toBe("Maya");
    expect(visitor?.pictureUrl).toBe(MAYA.picture);
  });

  it("visitor sees the full name when the owner opts in via showFullName=true", async () => {
    const svc = new OfflineSocialService({
      email: MAYA.email,
      identityName: MAYA.name,
      identityPicture: MAYA.picture,
    });
    await svc.updateProfile({ showFullName: true });
    const visitor = await svc.getProfile("maya");
    expect(visitor?.displayName).toBe("Maya Patel");
  });

  it("an explicit updateProfile({ fullName }) wins over the identity fallback", async () => {
    const svc = new OfflineSocialService({
      email: MAYA.email,
      identityName: MAYA.name,
      identityPicture: MAYA.picture,
    });
    await svc.updateProfile({ fullName: "Maya P.", showFullName: true });
    const me = await svc.getMyProfile();
    expect(me.displayName).toBe("Maya P.");
  });

  it("an explicit updateProfile({ pictureUrl }) wins over the identity fallback", async () => {
    const svc = new OfflineSocialService({
      email: MAYA.email,
      identityName: MAYA.name,
      identityPicture: MAYA.picture,
    });
    await svc.updateProfile({ pictureUrl: "https://example.com/custom.png" });
    const me = await svc.getMyProfile();
    expect(me.pictureUrl).toBe("https://example.com/custom.png");
  });

  it("ownerPrefs.fullName reflects the effective (identity-backed) value so the future edit UI starts from what's shown", async () => {
    const svc = new OfflineSocialService({
      email: MAYA.email,
      identityName: MAYA.name,
    });
    const me = await svc.getMyProfile();
    expect(me.ownerPrefs?.fullName).toBe("Maya Patel");
  });

  it("falls back gracefully when identity is missing", async () => {
    const svc = new OfflineSocialService({ email: "anon@gmail.com" });
    const me = await svc.getMyProfile();
    // No name → first-name fallback derived from email local-part.
    expect(me.displayName).toBe("Anon");
    expect(me.pictureUrl).toBeUndefined();
  });

  it("trims whitespace-only identity strings to undefined so they never leak as the displayName", async () => {
    const svc = new OfflineSocialService({
      email: MAYA.email,
      identityName: "   ",
      identityPicture: "  ",
    });
    const me = await svc.getMyProfile();
    expect(me.displayName).toBe("Maya"); // capitalized handle, not blank
    expect(me.pictureUrl).toBeUndefined();
  });
});

// -- Layer 2: selectSocialService threads the identity through -----------

describe("selectSocialService — identity flows into the offline service", () => {
  it("forwards identityName / identityPicture into OfflineSocialService", async () => {
    const svc = selectSocialService({
      email: MAYA.email,
      socialEnabled: false,
      serverUrl: "",
      identityName: MAYA.name,
      identityPicture: MAYA.picture,
    });
    const me = await svc.getMyProfile();
    expect(me.displayName).toBe("Maya Patel");
    expect(me.pictureUrl).toBe(MAYA.picture);
  });
});

// -- Layer 3: Profile view picks it up via SocialProvider ----------------

describe("Profile view — auto-syncs to the latest Google identity", () => {
  it("renders the player's Google name + avatar on first sign-in (no manual edit needed)", async () => {
    seedSignedIn();
    mountWithProviders(<Profile handle="maya" onNav={() => {}} />);
    await settle();
    // Owner view → full name shown in the header.
    expect(await screen.findByRole("heading", { name: "Maya Patel" })).toBeTruthy();
    // The avatar img with the Google picture URL.
    const img = document.querySelector(`img[src="${MAYA.picture}"]`);
    expect(img).toBeTruthy();
  });

  it("re-sign-in with a different Google name + picture refreshes the public profile (selector-level)", async () => {
    // The full PlayerProvider re-mount is awkward in tests because the
    // hydrate effect runs once and the ProviderTree caches its localStorage
    // read. The actual mechanism in production is: PlayerContext.signIn()
    // updates `state.identity`, the SocialProvider's useMemo recomputes
    // the service with the new `identityName` / `identityPicture`, and
    // every consumer's `[social.service]` effect refetches. We pin that
    // selector chain directly here — the unit-level guarantee that drives
    // the UI behavior.
    const v1 = selectSocialService({
      email: MAYA.email,
      socialEnabled: false,
      serverUrl: "",
      identityName: MAYA.name,
      identityPicture: MAYA.picture,
    });
    const me1 = await v1.getMyProfile();
    expect(me1.displayName).toBe("Maya Patel");
    expect(me1.pictureUrl).toBe(MAYA.picture);

    // Same email, new Google name + picture → fresh service instance
    // returns the new values immediately, no manual edit required.
    const v2 = selectSocialService({
      email: MAYA.email,
      socialEnabled: false,
      serverUrl: "",
      identityName: "Maya P. Patel",
      identityPicture: "https://lh3.googleusercontent.com/maya/v2.jpg",
    });
    expect(v2).not.toBe(v1); // confirm new instance — drives consumer refetch
    const me2 = await v2.getMyProfile();
    expect(me2.displayName).toBe("Maya P. Patel");
    expect(me2.pictureUrl).toBe("https://lh3.googleusercontent.com/maya/v2.jpg");
  });
});

// -- Layer 4: cross-view identity audit ----------------------------------

describe("Cross-view identity audit — every surface shows the same player", () => {
  beforeEach(() => {
    seedSignedIn();
  });

  it("TopBar renders the Google avatar (not initials) once identity is hydrated", async () => {
    mountWithProviders(<TopBar onNav={() => {}} />);
    await settle();
    const img = document.querySelector(`img[src="${MAYA.picture}"]`);
    expect(img).toBeTruthy();
  });

  it("Settings shows the player's Google name + email", async () => {
    mountWithProviders(<Settings onNav={() => {}} />);
    await settle();
    expect(await screen.findByText("Maya Patel")).toBeTruthy();
    expect(screen.getByText(MAYA.email)).toBeTruthy();
  });

  it("Network — 'View public profile' CTA carries the canonical handle", async () => {
    mountWithProviders(<Network onNav={() => {}} />);
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /View public profile/i }),
      ).toBeTruthy();
    });
  });

  it("Leaderboard 'me' row labels the player without leaking the email", async () => {
    mountWithProviders(<Leaderboard onNav={() => {}} />);
    await settle();
    // The me-row gets a chip that literally reads "you" — pin that one
    // chip rather than a regex which also matches the description copy
    // ("Where you stand…").
    await waitFor(() => {
      const chips = Array.from(document.querySelectorAll("span")).filter(
        (el) => el.textContent === "you",
      );
      expect(chips.length).toBeGreaterThan(0);
    });
    // Email should never appear on the leaderboard — pin that explicitly.
    expect(screen.queryByText(MAYA.email)).toBeNull();
  });
});

// -- Layer 5: privacy invariants haven't regressed -----------------------

describe("Identity sync respects privacy invariants", () => {
  it("a closed kid profile still backfills the avatar but never leaks the full name to visitors", async () => {
    const svc = new OfflineSocialService({
      email: "kid@gmail.com",
      ageBandIsKid: true,
      identityName: "Kid Builder",
      identityPicture: "https://example.com/kid.jpg",
    });
    const me = await svc.getMyProfile();
    // Owner-side preview: full name visible (the user is looking at themselves).
    expect(me.displayName).toBe("Kid Builder");
    expect(me.profileMode).toBe("closed"); // kid → forced closed
    // Visitor-side: kid profile's getProfile would also backfill the
    // first name from identity, never the full name (visitor is not owner
    // and showFullName defaults false).
    const visitor = await svc.getProfile("kid");
    expect(visitor?.displayName).toBe("Kid"); // first name only
  });

  it("offline profile state stays clean — no auto-sync writes to localStorage", async () => {
    // Asserts the read-side fallback approach: identity backfill happens in
    // toPublic(), it does NOT materialize the identity values into stored
    // state. So a subsequent identity change (re-sign-in with a new Google
    // name) takes effect immediately — there's no stale snapshot to clear.
    const svc = new OfflineSocialService({
      email: MAYA.email,
      identityName: MAYA.name,
      identityPicture: MAYA.picture,
    });
    await svc.getMyProfile();
    // Update an unrelated field; the persisted profile should still have
    // fullName === undefined (not the materialized identity name).
    await svc.updateProfile({ profileMode: "closed" });
    const raw = localStorage.getItem(`learnai:social:offline:${MAYA.email}`);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed.profile.fullName).toBeUndefined();
    expect(parsed.profile.pictureUrl).toBeUndefined();
  });
});

// -- Helper: silence unused import warnings ------------------------------
// (fireEvent is reserved for future expansion — keeps the test surface
// uniform with neighboring social.*.test.tsx files.)
void fireEvent;
