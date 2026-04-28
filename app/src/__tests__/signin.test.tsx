import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, render, screen, fireEvent } from "@testing-library/react";
import { PlayerProvider } from "../store/PlayerContext";
import { AdminProvider } from "../admin/AdminContext";
import { SignIn } from "../views/SignIn";
import { STORAGE_KEY } from "../store/game";

// Stub `loadGoogleScript` so we don't actually try to fetch GIS in tests.
vi.mock("../auth/google", async (orig) => {
  const real = await orig<typeof import("../auth/google")>();
  return {
    ...real,
    loadGoogleScript: vi.fn().mockResolvedValue(undefined),
  };
});

const VALID_CLIENT_ID = "123-test.apps.googleusercontent.com";

function mount() {
  return render(
    <PlayerProvider>
      <AdminProvider>
        <SignIn />
      </AdminProvider>
    </PlayerProvider>
  );
}

describe("SignIn — saved Google Client ID is honored after hydration", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("hides the Client ID input after the player state hydrates with a saved id", async () => {
    // Arrange: pretend the user previously saved a Client ID.
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ googleClientId: VALID_CLIENT_ID })
    );

    // Act: mount fresh.
    mount();

    // Initial render is pre-hydration → input may be visible briefly.
    // Run effects to pick up the localStorage-loaded state.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    // Assert: the "Google OAuth Client ID" label/input must be gone.
    expect(screen.queryByPlaceholderText(/apps\.googleusercontent\.com/)).toBeNull();
    // The "Use a different Client ID" escape hatch should be shown.
    expect(screen.getByRole("button", { name: /Use a different Client ID/i })).toBeTruthy();
  });

  it("still asks the user when no Client ID was previously saved", async () => {
    mount();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(screen.getByPlaceholderText(/apps\.googleusercontent\.com/)).toBeTruthy();
  });

  it("typing into the input enables the Save button (without re-asking after hydration)", async () => {
    mount();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    const input = screen.getByPlaceholderText(/apps\.googleusercontent\.com/) as HTMLInputElement;
    expect(input.value).toBe("");
    fireEvent.change(input, { target: { value: VALID_CLIENT_ID } });
    expect(input.value).toBe(VALID_CLIENT_ID);
  });
});
