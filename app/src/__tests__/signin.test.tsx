import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, render, screen, fireEvent } from "@testing-library/react";
import { PlayerProvider } from "../store/PlayerContext";
import { AdminProvider } from "../admin/AdminContext";
import { SignIn } from "../views/SignIn";
import { STORAGE_KEY } from "../store/game";
import { ADMIN_STORAGE_KEY } from "../admin/store";

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

async function settle() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

describe("SignIn — production mode (server auth) reads Client ID from admin config", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("hides the Client ID input when admin.serverAuth.googleClientId is set", async () => {
    localStorage.setItem(
      ADMIN_STORAGE_KEY,
      JSON.stringify({ serverAuth: { mode: "production", googleClientId: VALID_CLIENT_ID, mem0Url: "https://mem0.example.com" } })
    );
    mount();
    await settle();
    expect(screen.queryByPlaceholderText(/apps\.googleusercontent\.com/)).toBeNull();
  });

  it("renders our design-system Continue-with-Google button (not Google's white card)", async () => {
    localStorage.setItem(
      ADMIN_STORAGE_KEY,
      JSON.stringify({ serverAuth: { mode: "production", googleClientId: VALID_CLIENT_ID, mem0Url: "https://mem0.example.com" } })
    );
    mount();
    await settle();
    expect(screen.getByText("Continue with Google")).toBeTruthy();
  });

  it("does NOT show a 'Use a different Client ID' link to end users (admin-only concern)", async () => {
    localStorage.setItem(
      ADMIN_STORAGE_KEY,
      JSON.stringify({ serverAuth: { mode: "production", googleClientId: VALID_CLIENT_ID, mem0Url: "https://mem0.example.com" } })
    );
    mount();
    await settle();
    expect(screen.queryByText(/Use a different Client ID/i)).toBeNull();
  });

  it("asks for a Client ID when admin config is empty (production default, fresh install)", async () => {
    mount();
    await settle();
    expect(screen.getByPlaceholderText(/apps\.googleusercontent\.com/)).toBeTruthy();
  });

  it("does NOT show the demo-mode escape hatch in production", async () => {
    mount();
    await settle();
    expect(screen.queryByText(/Skip OAuth setup/i)).toBeNull();
  });
});

describe("SignIn — demo mode preserves the per-browser Client ID flow", () => {
  beforeEach(() => {
    localStorage.clear();
    // Force demo mode for this group, since production is the baked default.
    localStorage.setItem(
      ADMIN_STORAGE_KEY,
      JSON.stringify({ serverAuth: { mode: "demo", googleClientId: "", mem0Url: "" } })
    );
  });

  it("hides the Client ID input after PlayerState hydrates with a saved id", async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ googleClientId: VALID_CLIENT_ID })
    );
    mount();
    await settle();
    expect(screen.queryByPlaceholderText(/apps\.googleusercontent\.com/)).toBeNull();
    expect(screen.getByText("Continue with Google")).toBeTruthy();
  });

  it("asks the user when no Client ID was previously saved", async () => {
    mount();
    await settle();
    expect(screen.getByPlaceholderText(/apps\.googleusercontent\.com/)).toBeTruthy();
  });

  it("typing into the input does not collapse the form before Save", async () => {
    mount();
    await settle();
    const input = screen.getByPlaceholderText(/apps\.googleusercontent\.com/) as HTMLInputElement;
    expect(input.value).toBe("");
    fireEvent.change(input, { target: { value: VALID_CLIENT_ID } });
    expect(input.value).toBe(VALID_CLIENT_ID);
  });

  it("shows the demo-mode escape hatch", async () => {
    mount();
    await settle();
    expect(screen.getByText(/Skip OAuth setup/i)).toBeTruthy();
  });
});
