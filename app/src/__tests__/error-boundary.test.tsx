import { describe, it, expect, beforeEach, vi } from "vitest";
import type { ReactElement } from "react";
import { render, screen } from "@testing-library/react";
import { ErrorBoundary } from "../components/ErrorBoundary";

function Boom(): ReactElement {
  throw new Error("kaboom");
}

describe("ErrorBoundary", () => {
  beforeEach(() => {
    // Silence the React-supplied error log from the intentional throw.
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("renders children when no error", () => {
    render(
      <ErrorBoundary>
        <div>hello</div>
      </ErrorBoundary>
    );
    expect(screen.getByText("hello")).toBeTruthy();
  });

  it("renders fallback UI with the error message when a child throws", () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    );
    expect(screen.getByText(/Something broke/i)).toBeTruthy();
    expect(screen.getByText(/kaboom/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Reload$/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Erase local data and reload/i })).toBeTruthy();
  });
});
