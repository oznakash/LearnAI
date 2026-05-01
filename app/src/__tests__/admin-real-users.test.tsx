import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { PlayerProvider } from "../store/PlayerContext";
import { AdminProvider, useAdmin } from "../admin/AdminContext";
import { ADMIN_STORAGE_KEY } from "../admin/store";
import { STORAGE_KEY } from "../store/game";

/**
 * Wiring guarantees for the mem0 → Admin Console path.
 *
 * After mem0#13 (`GET /v1/state/admin/users`) + mem0#14 (richer shape +
 * `DELETE`), the Admin Console treats `user_state` as the canonical
 * "real users" list. These tests pin three things that previously broke:
 *
 *   1. Real users from mem0 land in `mockUsers` so the Users table
 *      renders them.
 *   2. The current admin's local row is preferred over their mem0 copy
 *      (no double rows).
 *   3. `wipeRealUserState("mem0:<email>")` calls the right URL with
 *      Bearer auth and refuses to wipe the signed-in admin.
 */

const MEM0_URL = "https://mem0.test";
const TOKEN = "session-jwt-fake";

function MergedProbe() {
  const { mockUsers, realUserCount, wipeRealUserState } = useAdmin();
  return (
    <div>
      <span data-testid="count">{mockUsers.length}</span>
      <span data-testid="emails">{mockUsers.map((u) => u.email).join(",")}</span>
      <span data-testid="real-count">{String(realUserCount)}</span>
      <button
        data-testid="wipe-other"
        onClick={() => {
          // bare-bones fire-and-forget; tests inspect the fetch mock
          void wipeRealUserState("mem0:other@gmail.com").catch(() => undefined);
        }}
      >
        wipe-other
      </button>
      <button
        data-testid="wipe-self"
        onClick={() => {
          void wipeRealUserState("mem0:admin@gmail.com").catch(() => undefined);
        }}
      >
        wipe-self
      </button>
    </div>
  );
}

function mount() {
  return render(
    <PlayerProvider>
      <AdminProvider>
        <MergedProbe />
      </AdminProvider>
    </PlayerProvider>
  );
}

async function settle() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 10));
  });
}

function seedSignedInAdmin() {
  // Player: signed-in identity + a session JWT so the AdminContext
  // mem0-fetch effect actually fires.
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      identity: { email: "admin@gmail.com", name: "Admin", provider: "google" },
      profile: { ageBand: "adult", skillLevel: "builder", interests: ["ai-foundations"], dailyMinutes: 10, createdAt: Date.now() - 86400000 },
      serverSession: { token: TOKEN, isAdmin: true, email: "admin@gmail.com", expiresAt: Date.now() + 3600_000 },
      xp: 999,
      streak: 9,
      history: [],
    })
  );
  localStorage.setItem(
    ADMIN_STORAGE_KEY,
    JSON.stringify({
      bootstrapped: true,
      admins: ["admin@gmail.com"],
      flags: { showDemoData: false },
      serverAuth: { mode: "demo", mem0Url: MEM0_URL, googleClientId: "x" },
    })
  );
}

describe("AdminContext × mem0 user_state", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("merges real users into mockUsers and dedupes self by email", async () => {
    seedSignedInAdmin();
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((async (
      input: string | URL | Request
    ) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/v1/state/admin/users")) {
        return new Response(
          JSON.stringify({
            count: 3,
            recent: [
              { email: "admin@gmail.com", updated_at: new Date().toISOString(), xp: 700, streak: 5, total_sparks: 30, total_minutes: 12, activity_14d: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3] },
              { email: "alice@gmail.com", updated_at: new Date().toISOString(), xp: 200, streak: 1, total_sparks: 10, total_minutes: 5, activity_14d: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1] },
              { email: "bob@gmail.com", updated_at: new Date().toISOString(), xp: 50, streak: 0, total_sparks: 2, total_minutes: 1, activity_14d: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
      return new Response("{}", { status: 200 });
    }) as typeof fetch);

    mount();
    await settle();

    expect(fetchSpy).toHaveBeenCalledWith(
      `${MEM0_URL}/v1/state/admin/users?limit=200`,
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: `Bearer ${TOKEN}` }),
      })
    );
    expect(screen.getByTestId("real-count").textContent).toBe("3");
    // 2 mem0 strangers + the local self row (not duplicated).
    expect(screen.getByTestId("count").textContent).toBe("3");
    const emails = (screen.getByTestId("emails").textContent ?? "").split(",");
    // Self appears exactly once.
    expect(emails.filter((e) => e === "admin@gmail.com")).toHaveLength(1);
    expect(emails).toEqual(expect.arrayContaining(["alice@gmail.com", "bob@gmail.com"]));
  });

  it("wipeRealUserState calls DELETE on the right URL with Bearer auth", async () => {
    seedSignedInAdmin();
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((async (
      input: string | URL | Request,
      init?: RequestInit
    ) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.endsWith("/v1/state/admin/users?limit=200") && (!init || init.method !== "DELETE")) {
        return new Response(
          JSON.stringify({
            count: 1,
            recent: [{ email: "other@gmail.com", updated_at: null, xp: 10, streak: 0 }],
          }),
          { status: 200 }
        );
      }
      if (init?.method === "DELETE") {
        return new Response(JSON.stringify({ message: "Wiped..." }), { status: 200 });
      }
      return new Response("{}", { status: 200 });
    }) as typeof fetch);

    mount();
    await settle();
    await act(async () => {
      screen.getByTestId("wipe-other").click();
      await new Promise((r) => setTimeout(r, 10));
    });

    const deleteCalls = fetchSpy.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === "DELETE");
    expect(deleteCalls.length).toBeGreaterThanOrEqual(1);
    expect(deleteCalls[0][0]).toBe(`${MEM0_URL}/v1/state/admin/users/other%40gmail.com`);
    expect((deleteCalls[0][1] as RequestInit).headers).toMatchObject({
      authorization: `Bearer ${TOKEN}`,
    });
  });

  it("wipeRealUserState refuses to wipe the currently signed-in admin", async () => {
    seedSignedInAdmin();
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ count: 0, recent: [] }), { status: 200 })
    );

    mount();
    await settle();
    await act(async () => {
      screen.getByTestId("wipe-self").click();
      await new Promise((r) => setTimeout(r, 10));
    });

    // No DELETE fetch was issued — the action threw locally.
    const deleteCalls = fetchSpy.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === "DELETE");
    expect(deleteCalls).toHaveLength(0);
  });
});
