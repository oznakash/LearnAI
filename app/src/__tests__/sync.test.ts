import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  loadRemoteState,
  mergeRemoteIntoLocal,
  pickSyncedFields,
  saveRemoteState,
  wipeRemoteState,
} from "../store/sync";
import { defaultState } from "../store/game";
import type { PlayerState } from "../types";

const MEM0 = "https://mem0.example.com";
const TOKEN = "session-jwt";

beforeEach(() => {
  globalThis.fetch = vi.fn() as unknown as typeof fetch;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("pickSyncedFields", () => {
  it("strips per-device fields (identity, serverSession, apiKey, googleClientId)", () => {
    const state: PlayerState = {
      ...defaultState(),
      xp: 42,
      identity: { email: "a@gmail.com", provider: "google" },
      serverSession: { token: "t", email: "a@gmail.com", isAdmin: true, expiresAt: 0 },
      apiKey: "sk-xxx",
      apiProvider: "anthropic",
      googleClientId: "abc.apps.googleusercontent.com",
    };
    const blob = pickSyncedFields(state) as Record<string, unknown>;
    expect(blob.xp).toBe(42);
    expect(blob.identity).toBeUndefined();
    expect(blob.serverSession).toBeUndefined();
    expect(blob.apiKey).toBeUndefined();
    expect(blob.googleClientId).toBeUndefined();
  });

  it("keeps profile, badges, history, tasks, prefs, etc.", () => {
    const state: PlayerState = {
      ...defaultState(),
      xp: 100,
      streak: 7,
      badges: ["welcome", "streak-1"],
      tasks: [{ id: "t-1", kind: "build", title: "x", status: "todo", createdAt: 1, updatedAt: 1 }],
    };
    const blob = pickSyncedFields(state);
    expect(blob.xp).toBe(100);
    expect(blob.streak).toBe(7);
    expect(blob.badges).toEqual(["welcome", "streak-1"]);
    expect(blob.tasks?.[0].title).toBe("x");
  });
});

describe("mergeRemoteIntoLocal", () => {
  it("returns the local state untouched when remote blob is empty", () => {
    const local: PlayerState = { ...defaultState(), xp: 50 };
    expect(mergeRemoteIntoLocal(local, {}).xp).toBe(50);
  });

  it("overwrites synced fields with remote values, preserves per-device ones", () => {
    const local: PlayerState = {
      ...defaultState(),
      xp: 5,
      identity: { email: "a@gmail.com", provider: "google" },
      googleClientId: "abc.apps.googleusercontent.com",
    };
    const merged = mergeRemoteIntoLocal(local, { xp: 999, badges: ["welcome"] });
    expect(merged.xp).toBe(999);
    expect(merged.badges).toEqual(["welcome"]);
    // Per-device kept verbatim
    expect(merged.identity?.email).toBe("a@gmail.com");
    expect(merged.googleClientId).toBe("abc.apps.googleusercontent.com");
  });
});

describe("loadRemoteState", () => {
  it("returns parsed envelope on 200", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ blob: { xp: 320 }, updated_at: "2026-04-30T17:00:00Z" }),
    });
    const env = await loadRemoteState(MEM0, TOKEN);
    expect(env).toEqual({ blob: { xp: 320 }, updatedAt: "2026-04-30T17:00:00Z" });
  });

  it("returns null on 401 / 5xx", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false, status: 401 });
    expect(await loadRemoteState(MEM0, TOKEN)).toBeNull();
  });

  it("returns null on network error", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("offline"));
    expect(await loadRemoteState(MEM0, TOKEN)).toBeNull();
  });

  it("returns null when url or token is empty (no fetch attempted)", async () => {
    expect(await loadRemoteState("", TOKEN)).toBeNull();
    expect(await loadRemoteState(MEM0, "")).toBeNull();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("authenticates with the bearer token", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ blob: {}, updated_at: null }),
    });
    await loadRemoteState(MEM0, TOKEN);
    const args = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(args[1].headers.authorization).toBe(`Bearer ${TOKEN}`);
  });
});

describe("saveRemoteState", () => {
  it("PUTs the blob with bearer auth", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: true, status: 200 });
    const blob = pickSyncedFields({ ...defaultState(), xp: 7 });
    const ok = await saveRemoteState(MEM0, TOKEN, blob);
    expect(ok).toBe(true);
    const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe(`${MEM0}/v1/state`);
    expect(init.method).toBe("PUT");
    expect(init.headers.authorization).toBe(`Bearer ${TOKEN}`);
    expect(JSON.parse(init.body).blob.xp).toBe(7);
  });

  it("returns false on 4xx / network error", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false, status: 413 });
    expect(await saveRemoteState(MEM0, TOKEN, { xp: 1 } as never)).toBe(false);

    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("offline"));
    expect(await saveRemoteState(MEM0, TOKEN, { xp: 1 } as never)).toBe(false);
  });
});

describe("wipeRemoteState", () => {
  it("DELETEs with bearer auth", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: true, status: 200 });
    expect(await wipeRemoteState(MEM0, TOKEN)).toBe(true);
    const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe(`${MEM0}/v1/state`);
    expect(init.method).toBe("DELETE");
    expect(init.headers.authorization).toBe(`Bearer ${TOKEN}`);
  });

  it("returns false on failure", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("offline"));
    expect(await wipeRemoteState(MEM0, TOKEN)).toBe(false);
  });
});
