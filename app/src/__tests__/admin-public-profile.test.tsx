import { describe, it, expect, beforeEach } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PlayerProvider } from "../store/PlayerContext";
import { AdminProvider } from "../admin/AdminContext";
import { MemoryProvider } from "../memory/MemoryContext";
import { SocialProvider } from "../social/SocialContext";
import { AdminPublicProfile } from "../admin/AdminPublicProfile";
import { OfflineSocialService } from "../social/offline";
import { ADMIN_STORAGE_KEY } from "../admin/store";
import { STORAGE_KEY } from "../store/game";

/**
 * Admin → Public Profile tab regression + integration tests.
 *
 * Covers:
 *  1. The tab renders (and shows the operator-level controls).
 *  2. Toggling defaults persists to localStorage admin config.
 *  3. The defaults flow into a fresh user's offline state on first
 *     profile creation, so a brand-new account starts from policy
 *     instead of the hardcoded "open + everything visible" baseline.
 *  4. Existing users (saved offline state) keep their saved values
 *     even after the operator changes defaults — the admin tab is
 *     policy-for-new-users, not retroactive.
 */

function bootstrapAdmin(email = "admin@learnai.dev") {
  // Mark this email as the bootstrapped admin so the AdminContext
  // resolves `isAdmin` true.
  localStorage.setItem(
    "builderquest:admin:bootstrap:v1",
    JSON.stringify({ email }),
  );
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      identity: { email, name: "Admin Owner", provider: "google" },
      profile: {
        name: "Admin",
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
}

function mountTab() {
  return render(
    <PlayerProvider>
      <AdminProvider>
        <MemoryProvider>
          <SocialProvider>
            <AdminPublicProfile />
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

beforeEach(() => {
  localStorage.clear();
  bootstrapAdmin();
});

describe("AdminPublicProfile tab", () => {
  it("renders the four operator sections", async () => {
    mountTab();
    await settle();
    expect(screen.getByText(/Default profile visibility for new sign-ups/i)).toBeTruthy();
    expect(screen.getByText(/SSR personalized learning content/i)).toBeTruthy();
    expect(screen.getByText(/Default field visibility for new users/i)).toBeTruthy();
    expect(screen.getByText(/Preview \+ reset/i)).toBeTruthy();
  });

  it("flipping 'Private' default persists to admin config", async () => {
    mountTab();
    await settle();
    const privateBtn = screen.getByRole("button", { name: /🔒 Private/i });
    await act(async () => {
      fireEvent.click(privateBtn);
    });
    await waitFor(() => {
      const raw = localStorage.getItem(ADMIN_STORAGE_KEY) ?? "{}";
      const cfg = JSON.parse(raw);
      expect(cfg.socialConfig?.publicProfile?.defaultProfileMode).toBe("closed");
    });
  });

  it("toggling 'Show personalized learning content' persists", async () => {
    mountTab();
    await settle();
    const checkbox = screen
      .getByText(/Show personalized learning content on public profiles/i)
      .closest("label")
      ?.querySelector("input[type=checkbox]") as HTMLInputElement | null;
    expect(checkbox).toBeTruthy();
    expect(checkbox!.checked).toBe(true); // default: on
    await act(async () => {
      fireEvent.click(checkbox!);
    });
    await waitFor(() => {
      const cfg = JSON.parse(localStorage.getItem(ADMIN_STORAGE_KEY) ?? "{}");
      expect(cfg.socialConfig?.publicProfile?.showLearningContent).toBe(false);
    });
  });

  it("flipping 'showActivity' default to false persists", async () => {
    mountTab();
    await settle();
    const checkbox = screen
      .getByText(/14-day activity sparkline/i)
      .closest("label")
      ?.querySelector("input[type=checkbox]") as HTMLInputElement | null;
    expect(checkbox?.checked).toBe(true); // default: on
    await act(async () => {
      fireEvent.click(checkbox!);
    });
    await waitFor(() => {
      const cfg = JSON.parse(localStorage.getItem(ADMIN_STORAGE_KEY) ?? "{}");
      expect(cfg.socialConfig?.publicProfile?.defaults?.showActivity).toBe(false);
    });
  });
});

// -- Integration: admin defaults flow into the OfflineSocialService -----

describe("Public-profile defaults flow into fresh offline-state creation", () => {
  it("a brand-new offline service with the default policy starts profileMode=open", async () => {
    // No saved offline state for this email — defaults apply.
    const svc = new OfflineSocialService({
      email: "fresh@gmail.com",
      profileDefaults: { defaultProfileMode: "open" },
    });
    const me = await svc.getMyProfile();
    expect(me.profileMode).toBe("open");
  });

  it("a brand-new offline service with profileDefaults=closed starts profileMode=closed", async () => {
    const svc = new OfflineSocialService({
      email: "fresh2@gmail.com",
      profileDefaults: { defaultProfileMode: "closed" },
    });
    const me = await svc.getMyProfile();
    expect(me.profileMode).toBe("closed");
  });

  it("an existing user keeps their saved profileMode even after admin defaults change", async () => {
    // Existing user saved as Open.
    const v1 = new OfflineSocialService({ email: "existing@gmail.com" });
    await v1.updateProfile({ profileMode: "open" });
    // Admin flips defaults to Closed; existing user instance — same email
    // but new defaults — should NOT have their saved Open mode reset.
    const v2 = new OfflineSocialService({
      email: "existing@gmail.com",
      profileDefaults: { defaultProfileMode: "closed" },
    });
    const me = await v2.getMyProfile();
    expect(me.profileMode).toBe("open");
  });

  it("kid profiles are forced to closed regardless of admin default", async () => {
    const svc = new OfflineSocialService({
      email: "kid@gmail.com",
      ageBandIsKid: true,
      profileDefaults: { defaultProfileMode: "open" },
    });
    const me = await svc.getMyProfile();
    expect(me.profileMode).toBe("closed");
  });

  it("per-field defaults flow through (showActivity=false → fresh user has it off)", async () => {
    const svc = new OfflineSocialService({
      email: "policy@gmail.com",
      profileDefaults: { showActivity: false },
    });
    const me = await svc.getMyProfile();
    expect(me.ownerPrefs?.showActivity).toBe(false);
    // Other defaults still apply.
    expect(me.ownerPrefs?.showCurrent).toBe(true);
  });
});
