import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PlayerProvider } from "../store/PlayerContext";
import { AdminProvider } from "../admin/AdminContext";
import { MemoryProvider } from "../memory/MemoryContext";
import { SocialProvider } from "../social/SocialContext";
import { AdminModeration } from "../admin/AdminModeration";
import { ADMIN_STORAGE_KEY } from "../admin/store";
import { STORAGE_KEY } from "../store/game";

const fetchMock = vi.fn<typeof fetch>();
const originalFetch = globalThis.fetch;

function mount() {
  return render(
    <PlayerProvider>
      <AdminProvider>
        <MemoryProvider>
          <SocialProvider>
            <AdminModeration />
          </SocialProvider>
        </MemoryProvider>
      </AdminProvider>
    </PlayerProvider>,
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  localStorage.clear();
  // Sign in as an admin.
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      identity: { email: "admin@learnai.dev", name: "Admin", provider: "google" },
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
  // Configure social-svc URL so the moderation tab makes real-shaped fetches.
  localStorage.setItem(
    ADMIN_STORAGE_KEY,
    JSON.stringify({
      socialConfig: { serverUrl: "https://social.test", apiKey: "k" },
      admins: ["admin@learnai.dev"],
      bootstrapped: true,
    }),
  );
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

const open = [
  {
    id: 1,
    reporter: "maya@gmail.com",
    reported: "priya@gmail.com",
    reason: "spam",
    note: "noisy",
    context: { kind: "profile" },
    status: "open",
    createdAt: Date.now() - 60_000,
  },
  {
    id: 2,
    reporter: "alex@gmail.com",
    reported: "yuki@gmail.com",
    reason: "harassment",
    status: "open",
    createdAt: Date.now() - 120_000,
  },
];

describe("AdminModeration", () => {
  it("loads open reports with X-User-Email + Authorization headers", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = String(typeof input === "string" ? input : (input as Request).url);
      if (url.includes("/v1/social/admin/reports")) {
        return new Response(JSON.stringify(open), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
    });
    mount();
    await waitFor(() => {
      expect(screen.getByText(/#1/)).toBeTruthy();
      expect(screen.getByText(/#2/)).toBeTruthy();
    });
    // Find the admin reports call (MemoryProvider may make its own).
    const adminCall = fetchMock.mock.calls.find((c) =>
      String(c[0]).includes("/v1/social/admin/reports?status=open"),
    );
    expect(adminCall).toBeDefined();
    const headers = (adminCall![1]?.headers ?? {}) as Record<string, string>;
    expect(headers["x-user-email"]).toBe("admin@learnai.dev");
    expect(headers["authorization"]).toBe("Bearer k");
  });

  it("renders a friendly empty state when there are no open reports", async () => {
    fetchMock.mockImplementation(async () =>
      new Response("[]", { status: 200, headers: { "content-type": "application/json" } }),
    );
    mount();
    await waitFor(() => {
      expect(screen.getByText(/No open reports/i)).toBeTruthy();
    });
  });

  it("clicking 'No action' POSTs the resolve endpoint and removes the row", async () => {
    // Branch by URL — the MemoryProvider also makes its own fetch calls,
    // so a sequenced mock would mis-attach.
    fetchMock.mockImplementation(async (input) => {
      const url = String(typeof input === "string" ? input : (input as Request).url);
      if (url.includes("/v1/social/admin/reports/1/resolve")) {
        return new Response(
          JSON.stringify({ ...open[0], status: "resolved", resolution: "no-action" }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (url.includes("/v1/social/admin/reports")) {
        return new Response(JSON.stringify(open), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      // Anything else (e.g. mem0 health) — generic ok.
      return new Response("{}", {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    mount();
    await waitFor(() => screen.getByText(/#1/));
    const noAction = screen.getAllByRole("button", { name: /No action/ });
    await act(async () => {
      fireEvent.click(noAction[0]!);
      await new Promise((r) => setTimeout(r, 10));
    });
    // The MemoryProvider also makes fetch calls (health check) — find the
    // resolve call by URL rather than relying on call ordering.
    const resolveCall = fetchMock.mock.calls.find((c) =>
      String(c[0]).includes("/v1/social/admin/reports/1/resolve"),
    );
    expect(resolveCall).toBeDefined();
    expect(resolveCall![1]?.method).toBe("POST");
    expect(JSON.parse((resolveCall![1]?.body as string) ?? "{}")).toMatchObject({
      resolution: "no-action",
    });
    // Optimistic removal: row #1 disappears from the open list.
    await waitFor(() => {
      expect(screen.queryByText(/#1/)).toBeNull();
    });
  });

  it("non-2xx response on the admin endpoint surfaces the error banner", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = String(typeof input === "string" ? input : (input as Request).url);
      if (url.includes("/v1/social/admin/reports")) {
        return new Response("forbidden", { status: 403 });
      }
      return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
    });
    mount();
    await waitFor(() => {
      expect(screen.getByText(/HTTP 403/)).toBeTruthy();
    });
  });

  it("Resolved tab fetches with status=resolved", async () => {
    fetchMock.mockImplementation(async () =>
      new Response("[]", { status: 200, headers: { "content-type": "application/json" } }),
    );
    mount();
    await waitFor(() => screen.getByRole("button", { name: /^Resolved$/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Resolved$/ }));
    await waitFor(() => {
      const adminCalls = fetchMock.mock.calls.filter((c) =>
        String(c[0]).includes("/v1/social/admin/reports"),
      );
      expect(adminCalls.some((c) => String(c[0]).includes("status=resolved"))).toBe(true);
    });
  });
});
