import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { PlayerProvider } from "../store/PlayerContext";
import { AdminProvider } from "../admin/AdminContext";
import { MemoryProvider } from "../memory/MemoryContext";
import { PulseStrip } from "../components/PulseStrip";
import { STORAGE_KEY } from "../store/game";
import type { PulseItem } from "../admin/types";

/**
 * Behavioural tests for the Home Pulse strip.
 *
 *   - default-collapsed; tap to expand.
 *   - expanded card shows the body + (when topicId) a "Start a Spark on this" CTA.
 *   - the CTA fires the onOpenTopic callback with the right topic id.
 *   - source link renders when the item has one.
 */

const ITEMS: PulseItem[] = [
  {
    id: "p-1",
    headline: "Frontier model race intensifies.",
    body: "Capability per dollar is dropping fast; what was $30k last year is hobby budget today.",
    addedAt: "2026-05-04",
    topicId: "ai-trends",
    audience: "all",
    source: { name: "AI Trends", url: "https://example.com/trends" },
  },
  {
    id: "p-2",
    headline: "Coding agents eat real ticket volume.",
    body: "Builders shipping agent-friendly repos compound faster.",
    addedAt: "2026-05-03",
    topicId: "ai-devtools",
    audience: "adult",
  },
];

function mount(onOpenTopic = vi.fn()) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      identity: { email: "alex@gmail.com", name: "Alex", provider: "google" },
    })
  );
  const utils = render(
    <PlayerProvider>
      <AdminProvider>
        <MemoryProvider>
          <PulseStrip items={ITEMS} onOpenTopic={onOpenTopic} />
        </MemoryProvider>
      </AdminProvider>
    </PlayerProvider>
  );
  return { ...utils, onOpenTopic };
}

async function settle() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

describe("PulseStrip", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders the section header + every headline", async () => {
    mount();
    await settle();
    expect(screen.getByText(/Today in AI/i)).toBeTruthy();
    expect(screen.getByText(/Frontier model race intensifies\./)).toBeTruthy();
    expect(screen.getByText(/Coding agents eat real ticket volume\./)).toBeTruthy();
  });

  it("starts with all cards collapsed (no body visible)", async () => {
    mount();
    await settle();
    expect(screen.queryByText(/Capability per dollar/)).toBeNull();
  });

  it("expands a card on click and shows the body", async () => {
    mount();
    await settle();
    fireEvent.click(screen.getByText(/Frontier model race intensifies\./));
    await settle();
    expect(screen.getByText(/Capability per dollar/)).toBeTruthy();
  });

  it("collapses an expanded card on second click", async () => {
    mount();
    await settle();
    fireEvent.click(screen.getByText(/Frontier model race intensifies\./));
    await settle();
    expect(screen.getByText(/Capability per dollar/)).toBeTruthy();
    fireEvent.click(screen.getByText(/Frontier model race intensifies\./));
    await settle();
    expect(screen.queryByText(/Capability per dollar/)).toBeNull();
  });

  it("fires onOpenTopic with the linked topicId when the CTA is tapped", async () => {
    const { onOpenTopic } = mount();
    await settle();
    fireEvent.click(screen.getByText(/Frontier model race intensifies\./));
    await settle();
    fireEvent.click(screen.getByText(/Start a Spark on this/));
    await settle();
    expect(onOpenTopic).toHaveBeenCalledTimes(1);
    expect(onOpenTopic).toHaveBeenCalledWith("ai-trends");
  });

  it("renders the 'via {source}' link when source is present", async () => {
    mount();
    await settle();
    fireEvent.click(screen.getByText(/Frontier model race intensifies\./));
    await settle();
    const link = screen.getByText(/via AI Trends/).closest("a") as HTMLAnchorElement;
    expect(link).toBeTruthy();
    expect(link.href).toContain("example.com/trends");
  });

  it("renders nothing when items is empty", () => {
    const { container } = render(
      <PlayerProvider>
        <AdminProvider>
          <MemoryProvider>
            <PulseStrip items={[]} onOpenTopic={vi.fn()} />
          </MemoryProvider>
        </AdminProvider>
      </PlayerProvider>
    );
    // section is null -> no children
    expect(container.querySelector("section")).toBeNull();
  });
});
