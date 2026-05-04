import { describe, it, expect, beforeEach } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PlayerProvider } from "../store/PlayerContext";
import { AdminProvider } from "../admin/AdminContext";
import { MemoryProvider } from "../memory/MemoryContext";
import { SocialProvider } from "../social/SocialContext";
import { Network } from "../views/Network";
import { OfflineSocialService } from "../social/offline";
import { STORAGE_KEY } from "../store/game";

function mount() {
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
    }),
  );
});

describe("Network view", () => {
  it("renders header + profile visibility toggles + signals picker", async () => {
    mount();
    await settle();
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /^Network$/ })).toBeTruthy();
    });
    expect(screen.getByRole("heading", { name: /^Profile visibility$/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /🌐 Public/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /🔒 Private/ })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /^Topics$/ })).toBeTruthy();
  });

  it("flipping the Private button persists profileMode=closed", async () => {
    mount();
    await settle();
    const privateButton = await screen.findByRole("button", { name: /🔒 Private/ });
    await act(async () => {
      fireEvent.click(privateButton);
      await new Promise((r) => setTimeout(r, 10));
    });
    const svc = new OfflineSocialService({ email: "maya@gmail.com" });
    const me = await svc.getMyProfile();
    expect(me.profileMode).toBe("closed");
  });

  it("kid profiles cannot flip to Public via the toggle (button disabled)", async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        identity: { email: "kid@gmail.com", name: "Kid", provider: "google" },
        profile: {
          name: "Kid",
          ageBand: "kid",
          skillLevel: "starter",
          interests: [],
          dailyMinutes: 5,
          goal: "",
          experience: "",
          createdAt: Date.now(),
        },
      }),
    );
    mount();
    // Wait for the kid-specific copy that only renders once the player
    // profile has hydrated and the social service has refreshed.
    await waitFor(() => {
      expect(screen.getByText(/kids profiles are always private/i)).toBeTruthy();
    });
    const openBtn = screen.getByRole("button", { name: /🌐 Public/ });
    expect((openBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it("Profile visibility renders BELOW Signals + People (low-priority anchor at the bottom)", async () => {
    // Operator: privacy controls aren't a first-time-user concern. They
    // belong at the foot of the page, after the editor + Signals +
    // People. This test pins the order so a future refactor doesn't
    // silently bubble visibility back up to the top.
    mount();
    await settle();
    await waitFor(() => screen.getByRole("heading", { name: /^Profile visibility$/ }));
    const headings = Array.from(document.querySelectorAll("h2")).map(
      (h) => h.textContent?.trim() ?? "",
    );
    const idxAbout = headings.indexOf("About you");
    const idxTopics = headings.indexOf("Topics");
    const idxPeople = headings.indexOf("People");
    const idxVisibility = headings.indexOf("Profile visibility");
    expect(idxAbout).toBeGreaterThan(-1);
    expect(idxTopics).toBeGreaterThan(idxAbout);
    expect(idxPeople).toBeGreaterThan(idxTopics);
    expect(idxVisibility).toBeGreaterThan(idxPeople);
  });

  it("Field-level visibility toggles are collapsed in a <details> by default (uncluttered first paint)", async () => {
    // The "When my profile is Public" wall-of-13-checkboxes used to
    // dominate the page. Now they sit inside a closed disclosure so a
    // first-time user isn't asked to make 13 micro-decisions before
    // they've even uploaded a photo.
    mount();
    await settle();
    await waitFor(() => screen.getByRole("heading", { name: /^Profile visibility$/ }));
    const summary = screen.getByText(/Show me what visitors can see/i);
    expect(summary).toBeTruthy();
    const details = summary.closest("details") as HTMLDetailsElement | null;
    expect(details).toBeTruthy();
    expect(details!.open).toBe(false);
  });

  it("Pronouns field is removed from the editor (operator decision — see docs/profile.md §7)", async () => {
    mount();
    await settle();
    await waitFor(() => screen.getByRole("heading", { name: /^About you$/ }));
    expect(screen.queryByText(/^Pronouns$/i)).toBeNull();
    expect(screen.queryByPlaceholderText(/^she\/her$/i)).toBeNull();
  });

  it("Connect-with-LinkedIn CTA renders below the LinkedIn input and captures intent on click", async () => {
    mount();
    await settle();
    await waitFor(() => screen.getByRole("heading", { name: /^About you$/ }));
    const cta = await screen.findByTestId("linkedin-intent-cta");
    expect(cta.textContent).toMatch(/Connect with LinkedIn/i);
    await act(async () => {
      fireEvent.click(cta);
    });
    expect(screen.getByTestId("linkedin-intent-captured")).toBeTruthy();
    expect(localStorage.getItem("learnai:linkedin:intent")).toBeTruthy();
  });

  it("Saving Topics writes BOTH social.signals AND state.profile.interests (one decision, dual-write)", async () => {
    mount();
    await settle();
    await waitFor(() => screen.getByRole("heading", { name: /^Topics$/ }));
    // Click two topic buttons inside the Topics picker. The buttons are
    // labeled by emoji + topic name; pin the click via partial match.
    const aiFoundations = await screen.findByRole("button", { name: /AI Foundations/i });
    await act(async () => {
      fireEvent.click(aiFoundations);
    });
    const aiBuilder = await screen.findByRole("button", { name: /AI Builder/i });
    await act(async () => {
      fireEvent.click(aiBuilder);
    });
    const saveButton = await screen.findByRole("button", { name: /^Save Topics$/i });
    await act(async () => {
      fireEvent.click(saveButton);
      await new Promise((r) => setTimeout(r, 20));
    });
    // Social-svc side: signals persisted.
    const svc = new OfflineSocialService({ email: "maya@gmail.com" });
    const me = await svc.getMyProfile();
    expect(me.signals).toContain("ai-foundations");
    expect(me.signals).toContain("ai-builder");
    // PlayerContext side: interests mirror the same selection.
    const playerRaw = localStorage.getItem(STORAGE_KEY)!;
    const player = JSON.parse(playerRaw);
    expect(player.profile.interests).toContain("ai-foundations");
    expect(player.profile.interests).toContain("ai-builder");
  });

  it("setSignals call from the Save button caps at 5 (service-side enforcement)", async () => {
    mount();
    await settle();
    await waitFor(() => screen.getByRole("heading", { name: /^Topics$/ }));
    // Click 6 distinct topic buttons inside the Signals picker. The picker
    // itself disables further selections after 5; but to verify the
    // service cap survives even if a stale UI state submits 6, we drive
    // the OfflineSocialService directly.
    const svc = new OfflineSocialService({ email: "maya@gmail.com" });
    const got = await svc.setSignals([
      "ai-foundations",
      "ai-pm",
      "ai-builder",
      "ai-trends",
      "ai-news",
      "memory-safety",
    ] as never);
    expect(got.length).toBe(5);
  });
});

describe("PublicProfile.ownerPrefs (offline)", () => {
  it("includes ownerPrefs only when the viewer is the owner", async () => {
    const svc = new OfflineSocialService({ email: "maya@gmail.com" });
    const owner = await svc.getMyProfile();
    expect(owner.ownerPrefs).toBeDefined();
    expect(owner.ownerPrefs!.showFullName).toBe(false);
    expect(owner.ownerPrefs!.showCurrent).toBe(true);
    expect(owner.ownerPrefs!.showMap).toBe(true);

    const visitor = await svc.getProfile("maya");
    expect(visitor?.ownerPrefs).toBeUndefined();
  });

  it("ownerPrefs.fullName mirrors the stored fullName", async () => {
    const svc = new OfflineSocialService({ email: "maya@gmail.com" });
    await svc.updateProfile({ fullName: "Maya Patel" });
    const owner = await svc.getMyProfile();
    expect(owner.ownerPrefs?.fullName).toBe("Maya Patel");
  });
});
