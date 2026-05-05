import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { ConnectLinkedinCta } from "../views/Network";
import * as socialCtx from "../social/SocialContext";
import type { LinkedinIdentity } from "../social/types";

/**
 * Strategy: docs/profile-linkedin.md.
 *
 * The CTA has four runtime modes:
 *
 *   loading       — first probe in flight (chrome rendered, button disabled)
 *   unavailable   — server says enabled=false OR no linkedin client
 *                   (offline mode) OR the probe errored. Falls back to
 *                   intent capture, identical to the v0 behavior.
 *   available     — enabled=true, no identity stored. Real OAuth CTA.
 *                   Click → `start()` → `window.location.href`.
 *   connected     — identity stored. Surfaces the identity panel,
 *                   transparency disclosure, and (when freshly connected
 *                   via ?linkedin=connected) the "Use this name" panel.
 */

const SAMPLE_IDENTITY: LinkedinIdentity = {
  email: "maya@gmail.com",
  visible: {
    name: "Maya Patel",
    givenName: "Maya",
    familyName: "Patel",
    pictureUrl: "https://media.licdn.com/photo.jpg",
    email: "maya@stripe.com",
  },
  context: {
    sub: "linkedin-sub-9999",
    emailVerified: true,
    locale: "en_US",
    emailDomain: "stripe.com",
    pictureCdnHost: "media.licdn.com",
    rawClaims: { sub: "linkedin-sub-9999" },
    connectedAt: 1_700_000_000_000,
    refreshedAt: 1_700_000_000_000,
  },
};

// Helper that returns a `useSocial` stub. The test mocks the SocialContext
// module so any React component pulling `useSocial()` gets this fake.
function fakeSocial(linkedin: unknown) {
  return { linkedin } as unknown as ReturnType<typeof socialCtx.useSocial>;
}

beforeEach(() => {
  // History pushes happen in the connect callback handler. Reset the URL
  // each test so we don't leak ?linkedin=connected across cases.
  window.history.replaceState({}, "", "/network");
  localStorage.clear();
});

describe("ConnectLinkedinCta", () => {
  it("falls back to intent capture when the SPA is offline (linkedin client null)", async () => {
    vi.spyOn(socialCtx, "useSocial").mockReturnValue(fakeSocial(null));
    render(<ConnectLinkedinCta />);
    const cta = await screen.findByTestId("linkedin-intent-cta");
    expect(cta.textContent).toMatch(/Connect with LinkedIn/i);
    await act(async () => {
      fireEvent.click(cta);
    });
    expect(screen.getByTestId("linkedin-intent-captured")).toBeTruthy();
    expect(localStorage.getItem("learnai:linkedin:intent")).toBeTruthy();
  });

  it("falls back to intent capture when the server reports enabled=false", async () => {
    const linkedin = {
      config: vi.fn().mockResolvedValue({ enabled: false }),
      me: vi.fn(),
      start: vi.fn(),
      disconnect: vi.fn(),
    };
    vi.spyOn(socialCtx, "useSocial").mockReturnValue(fakeSocial(linkedin));
    render(<ConnectLinkedinCta />);
    await waitFor(() => screen.getByTestId("linkedin-intent-cta"));
    expect(linkedin.config).toHaveBeenCalled();
    expect(linkedin.me).not.toHaveBeenCalled();
  });

  it("falls back to intent capture on probe errors (network down / sidecar dead)", async () => {
    const linkedin = {
      config: vi.fn().mockRejectedValue(new Error("network down")),
      me: vi.fn(),
      start: vi.fn(),
      disconnect: vi.fn(),
    };
    vi.spyOn(socialCtx, "useSocial").mockReturnValue(fakeSocial(linkedin));
    render(<ConnectLinkedinCta />);
    await waitFor(() => screen.getByTestId("linkedin-intent-cta"));
  });

  it("renders the OAuth CTA when enabled=true and no identity is stored", async () => {
    const linkedin = {
      config: vi.fn().mockResolvedValue({ enabled: true }),
      me: vi.fn().mockResolvedValue({ connected: false }),
      start: vi.fn().mockResolvedValue({ url: "https://www.linkedin.com/oauth/v2/authorization?..." }),
      disconnect: vi.fn(),
    };
    vi.spyOn(socialCtx, "useSocial").mockReturnValue(fakeSocial(linkedin));
    render(<ConnectLinkedinCta />);
    const cta = await screen.findByTestId("linkedin-oauth-cta");
    expect(cta.textContent).toMatch(/Connect with LinkedIn/i);
    expect(linkedin.config).toHaveBeenCalled();
    expect(linkedin.me).toHaveBeenCalled();
    // Importantly: we did NOT render the intent CTA in OAuth mode.
    expect(screen.queryByTestId("linkedin-intent-cta")).toBeNull();
  });

  it("clicking the OAuth CTA calls start() and navigates the browser to the authorize URL", async () => {
    // jsdom's window.location is read-only by default; spy on the assignment.
    const original = window.location;
    const setHrefSpy = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      writable: true,
      value: {
        ...original,
        get href() {
          return original.href;
        },
        set href(v: string) {
          setHrefSpy(v);
        },
      },
    });

    const linkedin = {
      config: vi.fn().mockResolvedValue({ enabled: true }),
      me: vi.fn().mockResolvedValue({ connected: false }),
      start: vi.fn().mockResolvedValue({
        url: "https://www.linkedin.com/oauth/v2/authorization?client_id=x",
      }),
      disconnect: vi.fn(),
    };
    vi.spyOn(socialCtx, "useSocial").mockReturnValue(fakeSocial(linkedin));
    render(<ConnectLinkedinCta />);
    const cta = await screen.findByTestId("linkedin-oauth-cta");
    await act(async () => {
      fireEvent.click(cta);
    });
    await waitFor(() => expect(linkedin.start).toHaveBeenCalled());
    await waitFor(() => expect(setHrefSpy).toHaveBeenCalledWith(
      "https://www.linkedin.com/oauth/v2/authorization?client_id=x",
    ));

    // restore
    Object.defineProperty(window, "location", {
      configurable: true,
      writable: true,
      value: original,
    });
  });

  it("renders the connected panel + transparency disclosure when an identity is stored", async () => {
    const linkedin = {
      config: vi.fn().mockResolvedValue({ enabled: true }),
      me: vi.fn().mockResolvedValue({ connected: true, identity: SAMPLE_IDENTITY }),
      start: vi.fn(),
      disconnect: vi.fn(),
    };
    vi.spyOn(socialCtx, "useSocial").mockReturnValue(fakeSocial(linkedin));
    render(<ConnectLinkedinCta />);
    const panel = await screen.findByTestId("linkedin-connected-panel");
    expect(panel.textContent).toMatch(/Connected as Maya Patel/);
    expect(panel.textContent).toMatch(/maya@stripe\.com/);
    // Transparency disclosure is collapsed by default
    expect(screen.queryByTestId("linkedin-transparency-panel")).toBeNull();
    const toggle = screen.getByTestId("linkedin-transparency-toggle");
    await act(async () => {
      fireEvent.click(toggle);
    });
    const transparency = await screen.findByTestId("linkedin-transparency-panel");
    // Bucket B fields appear in the transparency panel; visible-bucket
    // fields don't (they're shown in the editor + the connected header).
    expect(transparency.textContent).toMatch(/linkedin-sub-9999/);
    expect(transparency.textContent).toMatch(/stripe\.com/);
    expect(transparency.textContent).toMatch(/media\.licdn\.com/);
  });

  it("surfaces the 'Use this name' panel only when ?linkedin=connected is in the URL", async () => {
    window.history.replaceState({}, "", "/network?linkedin=connected");
    const onApplyName = vi.fn();
    const linkedin = {
      config: vi.fn().mockResolvedValue({ enabled: true }),
      me: vi.fn().mockResolvedValue({ connected: true, identity: SAMPLE_IDENTITY }),
      start: vi.fn(),
      disconnect: vi.fn(),
    };
    vi.spyOn(socialCtx, "useSocial").mockReturnValue(fakeSocial(linkedin));
    render(<ConnectLinkedinCta onApplyName={onApplyName} />);
    const apply = await screen.findByTestId("linkedin-apply-name");
    expect(apply.textContent).toMatch(/Use this name/);
    await act(async () => {
      fireEvent.click(apply);
    });
    expect(onApplyName).toHaveBeenCalledWith("Maya Patel");
    // The panel disappears after Use-this-name (not stuck on screen).
    expect(screen.queryByTestId("linkedin-apply-panel")).toBeNull();
    // The query string is cleared so a refresh doesn't reshow the panel.
    expect(window.location.search).toBe("");
  });

  it("does NOT show the apply panel for already-connected users (no ?linkedin=connected)", async () => {
    const linkedin = {
      config: vi.fn().mockResolvedValue({ enabled: true }),
      me: vi.fn().mockResolvedValue({ connected: true, identity: SAMPLE_IDENTITY }),
      start: vi.fn(),
      disconnect: vi.fn(),
    };
    vi.spyOn(socialCtx, "useSocial").mockReturnValue(fakeSocial(linkedin));
    render(<ConnectLinkedinCta onApplyName={vi.fn()} />);
    await screen.findByTestId("linkedin-connected-panel");
    expect(screen.queryByTestId("linkedin-apply-panel")).toBeNull();
  });

  it("clicking Disconnect calls the API and falls back to the available state", async () => {
    const linkedin = {
      config: vi.fn().mockResolvedValue({ enabled: true }),
      me: vi.fn().mockResolvedValue({ connected: true, identity: SAMPLE_IDENTITY }),
      start: vi.fn(),
      disconnect: vi.fn().mockResolvedValue({ ok: true, removed: true }),
    };
    vi.spyOn(socialCtx, "useSocial").mockReturnValue(fakeSocial(linkedin));
    render(<ConnectLinkedinCta />);
    const disconnectBtn = await screen.findByTestId("linkedin-disconnect");
    await act(async () => {
      fireEvent.click(disconnectBtn);
    });
    await waitFor(() =>
      expect(screen.queryByTestId("linkedin-connected-panel")).toBeNull(),
    );
    expect(linkedin.disconnect).toHaveBeenCalled();
    // OAuth-mode CTA back on screen (we're in `available` state again)
    expect(screen.getByTestId("linkedin-oauth-cta")).toBeTruthy();
  });

  it("surfaces an error message when ?linkedin=error&reason=already_linked", async () => {
    window.history.replaceState({}, "", "/network?linkedin=error&reason=already_linked");
    const linkedin = {
      config: vi.fn().mockResolvedValue({ enabled: true }),
      me: vi.fn().mockResolvedValue({ connected: false }),
      start: vi.fn(),
      disconnect: vi.fn(),
    };
    vi.spyOn(socialCtx, "useSocial").mockReturnValue(fakeSocial(linkedin));
    render(<ConnectLinkedinCta />);
    await screen.findByTestId("linkedin-oauth-cta");
    await waitFor(() => {
      expect(
        screen.getByText(/already connected to a different LearnAI account/i),
      ).toBeTruthy();
    });
    // URL params cleared
    expect(window.location.search).toBe("");
  });
});
