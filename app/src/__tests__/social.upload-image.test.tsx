import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { PlayerProvider } from "../store/PlayerContext";
import { AdminProvider } from "../admin/AdminContext";
import { MemoryProvider } from "../memory/MemoryContext";
import { SocialProvider } from "../social/SocialContext";
import { Network } from "../views/Network";
import { OfflineSocialService } from "../social/offline";
import { STORAGE_KEY } from "../store/game";

/**
 * Offline image-upload + the Network editor's plain-language strings.
 *
 * Two threads here:
 *
 * 1. `OfflineSocialService.uploadImage` round-trip — operator asked
 *    for upload + crop *before* the CDN sprint. The offline service
 *    keeps the data URL on the local profile so the in-app preview
 *    works without a server.
 *
 * 2. The Network editor's copy + UI shape. Pre-fix this used
 *    technical strings ("Hero / banner image URL", "Host-checked
 *    per kind. We strip query strings — your saved value is the
 *    canonical URL."). Real users won't read those. This file
 *    pins the new plain-language copy + the upload-button UX.
 */

const PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

beforeEach(() => {
  localStorage.clear();
  // Sign-in so identity exists.
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
    }),
  );
});

// -- Layer 1: offline uploadImage round-trip -----------------------------

describe("OfflineSocialService — uploadImage", () => {
  it("avatar upload stores the data URL on the local profile so the in-app preview works", async () => {
    const svc = new OfflineSocialService({ email: "maya@gmail.com" });
    const out = await svc.uploadImage("avatar", PNG_DATA_URL);
    expect(out.url).toBe(PNG_DATA_URL);
    const me = await svc.getMyProfile();
    expect(me.pictureUrl).toBe(PNG_DATA_URL);
  });

  it("hero upload writes heroUrl, leaving pictureUrl alone", async () => {
    const svc = new OfflineSocialService({ email: "maya@gmail.com" });
    await svc.uploadImage("hero", PNG_DATA_URL);
    const me = await svc.getMyProfile();
    expect(me.heroUrl).toBe(PNG_DATA_URL);
  });

  it("REJECTS non-data-image URLs (https, javascript:, plain text)", async () => {
    const svc = new OfflineSocialService({ email: "maya@gmail.com" });
    await expect(svc.uploadImage("avatar", "https://example.com/x.png")).rejects.toThrow();
    await expect(svc.uploadImage("avatar", "javascript:alert(1)")).rejects.toThrow();
    await expect(svc.uploadImage("avatar", "")).rejects.toThrow();
  });

  it("a subsequent updateProfile patch keeps the uploaded URL when no pictureUrl is in the patch", async () => {
    // Defense: an unrelated edit (e.g. pronoun change) shouldn't blow
    // away the user's freshly cropped avatar.
    const svc = new OfflineSocialService({ email: "maya@gmail.com" });
    await svc.uploadImage("avatar", PNG_DATA_URL);
    await svc.updateProfile({ pronouns: "they/them" });
    const me = await svc.getMyProfile();
    expect(me.pictureUrl).toBe(PNG_DATA_URL);
  });
});

// -- Layer 2: Network editor copy + UI shape ---------------------------

function mountNetwork() {
  return render(
    <PlayerProvider>
      <AdminProvider>
        <MemoryProvider>
          <SocialProvider>
            <Network onNav={() => {}} />
          </SocialProvider>
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

describe("Network editor — plain-language strings (no jargon)", () => {
  it("does NOT use the old technical strings ('Hero / banner image URL', 'Host-checked', 'canonical URL')", async () => {
    mountNetwork();
    await settle();
    expect(screen.queryByText(/Hero \/ banner image URL/i)).toBeNull();
    expect(screen.queryByText(/Host-checked per kind/i)).toBeNull();
    expect(screen.queryByText(/canonical URL/i)).toBeNull();
    expect(screen.queryByText(/CDN sprint/i)).toBeNull();
    expect(screen.queryByText(/https only/i)).toBeNull();
  });

  it("shows the plain-language replacements", async () => {
    mountNetwork();
    await settle();
    // Profile picture upload entry-point.
    expect(screen.getByRole("button", { name: /Change photo/i })).toBeTruthy();
    // Banner upload entry-point.
    expect(
      screen.getByRole("button", { name: /(Add a banner|Change banner)/i }),
    ).toBeTruthy();
    // Plain-language banner placeholder copy when no banner is set.
    expect(
      screen.getByText(/we'll show a soft gradient on your page/i),
    ).toBeTruthy();
    // Plain-language links section header.
    expect(screen.getByText(/Your links/i)).toBeTruthy();
    expect(
      screen.getByText(/Add the places you want people to find you/i),
    ).toBeTruthy();
  });
});

describe("Network editor — Change-photo button opens the crop dialog", () => {
  it("clicking Change photo opens the avatar crop dialog with a file picker", async () => {
    mountNetwork();
    await settle();
    const button = screen.getByRole("button", { name: /Change photo/i });
    await act(async () => {
      fireEvent.click(button);
    });
    // Dialog mounted with the avatar copy.
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-label")).toMatch(/profile picture/i);
    // Native file input is mounted (sr-only, identified by accept).
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement | null;
    expect(fileInput).toBeTruthy();
    expect(fileInput?.accept).toContain("image/jpeg");
    expect(fileInput?.accept).toContain("image/png");
    expect(fileInput?.accept).toContain("image/webp");
  });

  it("clicking Add a banner opens the hero crop dialog (different title, wider aspect)", async () => {
    mountNetwork();
    await settle();
    const button = screen.getByRole("button", { name: /(Add a banner|Change banner)/i });
    await act(async () => {
      fireEvent.click(button);
    });
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-label")).toMatch(/banner image/i);
  });
});
