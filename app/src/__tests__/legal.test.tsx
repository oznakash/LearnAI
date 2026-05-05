import { describe, it, expect, beforeEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import { Legal } from "../views/Legal";
import { viewFromPath, pathForView } from "../store/router";
import { PlayerProvider, usePlayer } from "../store/PlayerContext";

/**
 * Legal pages — strategy: docs/legal/{privacy,terms}.md.
 *
 * Server-rendered for crawlers + the LinkedIn OAuth review bot
 * (services/social-svc/src/legal.ts); the SPA view here handles
 * client-side navigation for signed-in users from the footer.
 */

beforeEach(() => {
  // Tests render Legal directly; no global state to reset.
  document.body.innerHTML = "";
});

describe("Legal view", () => {
  it("renders the Privacy Policy heading + first section", () => {
    render(<Legal kind="privacy" />);
    expect(screen.getByRole("heading", { level: 1, name: /Privacy Policy/i })).toBeTruthy();
    // The 3-questions structure introduced in §1 is the spine of the doc.
    expect(screen.getByText(/three questions/i)).toBeTruthy();
  });

  it("renders the Terms of Use heading + the 'deal in one paragraph' section", () => {
    render(<Legal kind="terms" />);
    expect(screen.getByRole("heading", { level: 1, name: /Terms of Use/i })).toBeTruthy();
    expect(screen.getByText(/deal in one paragraph/i)).toBeTruthy();
  });

  it("renders the in-page footer with Privacy / Terms / Source links", () => {
    render(<Legal kind="privacy" />);
    const links = Array.from(document.querySelectorAll("a")).map(
      (a) => `${a.textContent}|${a.getAttribute("href")}`,
    );
    expect(links.some((l) => l.includes("Privacy Policy|/privacy"))).toBe(true);
    expect(links.some((l) => l.includes("Terms of Use|/terms"))).toBe(true);
    expect(links.some((l) => l.includes("Source code|https://github.com/oznakash/learnai"))).toBe(true);
  });
});

describe("agreedToLegalAt audit ledger", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("stamps `agreedToLegalAt` on first sign-in", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <PlayerProvider>{children}</PlayerProvider>
    );
    const { result } = renderHook(() => usePlayer(), { wrapper });
    const before = Date.now();
    act(() => {
      result.current.signIn({ email: "maya@gmail.com", name: "Maya Patel" });
    });
    const stamped = result.current.state.identity?.agreedToLegalAt;
    expect(stamped).toBeTruthy();
    expect(stamped!).toBeGreaterThanOrEqual(before);
  });

  it("preserves the original `agreedToLegalAt` on a same-email re-sign-in", async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <PlayerProvider>{children}</PlayerProvider>
    );
    const { result } = renderHook(() => usePlayer(), { wrapper });
    act(() => {
      result.current.signIn({ email: "maya@gmail.com", name: "Maya Patel" });
    });
    const first = result.current.state.identity?.agreedToLegalAt;
    expect(first).toBeTruthy();
    // Wait at least 1 ms so a re-stamp would be visible.
    await new Promise((r) => setTimeout(r, 2));
    act(() => {
      result.current.signIn({ email: "maya@gmail.com", name: "Maya P." });
    });
    expect(result.current.state.identity?.agreedToLegalAt).toBe(first);
  });
});

describe("router /privacy + /terms", () => {
  it("maps /privacy → legal:privacy", () => {
    expect(viewFromPath("/privacy")).toEqual({ name: "legal", kind: "privacy" });
  });

  it("maps /terms → legal:terms", () => {
    expect(viewFromPath("/terms")).toEqual({ name: "legal", kind: "terms" });
  });

  it("encodes legal:privacy → /privacy", () => {
    expect(pathForView({ name: "legal", kind: "privacy" })).toBe("/privacy");
    expect(pathForView({ name: "legal", kind: "terms" })).toBe("/terms");
  });
});
