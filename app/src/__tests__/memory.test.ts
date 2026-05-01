import { describe, it, expect, beforeEach, vi } from "vitest";
import { OfflineMemoryService, Mem0MemoryService, withMemoryGuard } from "../memory";

describe("OfflineMemoryService", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("add → list → forget → wipe round-trip", async () => {
    const svc = new OfflineMemoryService("alex@gmail.com");
    const a = await svc.add({ text: "Goal: ship a RAG demo", category: "goal" });
    const b = await svc.add({ text: "Prefers vendor-neutral examples", category: "preference" });
    expect(a.id).toBeTruthy();
    expect(b.id).not.toBe(a.id);

    const list = await svc.list();
    expect(list.length).toBe(2);

    const goalsOnly = await svc.list({ category: "goal" });
    expect(goalsOnly).toHaveLength(1);
    expect(goalsOnly[0].text).toMatch(/RAG/);

    await svc.forget(a.id);
    expect(await svc.list()).toHaveLength(1);

    await svc.wipe();
    expect(await svc.list()).toEqual([]);
  });

  it("substring search returns matching items, recency-boosted", async () => {
    const svc = new OfflineMemoryService("alex@gmail.com");
    await svc.add({ text: "Loves pgvector", category: "preference" });
    await new Promise((r) => setTimeout(r, 5));
    await svc.add({ text: "Wants to learn about embeddings", category: "goal" });
    const found = await svc.search("embedding");
    expect(found.length).toBeGreaterThan(0);
    expect(found[0].text).toMatch(/embedding/i);
  });

  it("update keeps id but bumps updatedAt", async () => {
    const svc = new OfflineMemoryService("alex@gmail.com");
    const m = await svc.add({ text: "Original", category: "preference" });
    await new Promise((r) => setTimeout(r, 2));
    const updated = await svc.update(m.id, { text: "Edited" });
    expect(updated.id).toBe(m.id);
    expect(updated.text).toBe("Edited");
    expect(updated.updatedAt).toBeGreaterThanOrEqual(m.updatedAt);
  });

  it("partitions per user (different storage keys)", async () => {
    const a = new OfflineMemoryService("a@gmail.com");
    const b = new OfflineMemoryService("b@gmail.com");
    await a.add({ text: "for A", category: "goal" });
    expect(await a.list()).toHaveLength(1);
    expect(await b.list()).toHaveLength(0);
  });

  it("health is always ok for offline", async () => {
    const svc = new OfflineMemoryService("alex@gmail.com");
    expect(await svc.health()).toEqual({ ok: true, backend: "offline" });
  });
});

describe("Mem0MemoryService", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  const baseOpts = {
    serverUrl: "https://mem0.example.com",
    apiKey: "shh",
    userId: "alex@gmail.com",
  };

  it("add posts to /v1/memories/ with bearer auth and user_id", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ id: "m_1", memory: "Goal: RAG demo" }), { status: 200, headers: { "content-type": "application/json" } })
    );
    const svc = new Mem0MemoryService(baseOpts);
    const item = await svc.add({ text: "Goal: ship a RAG demo", category: "goal" });
    expect(item.id).toBe("m_1");
    expect(item.text).toBe("Goal: RAG demo");

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://mem0.example.com/v1/memories/");
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["authorization"]).toBe("Bearer shh");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.user_id).toBe("alex@gmail.com");
    expect(body.metadata.category).toBe("goal");
    expect(body.messages[0].content).toBe("Goal: ship a RAG demo");
  });

  it("search posts to /v1/memories/search/ and unwraps results[]", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ results: [{ id: "m_1", memory: "uses Postgres" }] }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    const svc = new Mem0MemoryService(baseOpts);
    const items = await svc.search("stack", { topK: 3 });
    expect(items).toHaveLength(1);
    expect(items[0].text).toBe("uses Postgres");
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://mem0.example.com/v1/memories/search/");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.query).toBe("stack");
    expect(body.limit).toBe(3);
    expect(body.user_id).toBe("alex@gmail.com");
  });

  it("list passes user_id as query param", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ results: [] }), { status: 200, headers: { "content-type": "application/json" } })
    );
    const svc = new Mem0MemoryService(baseOpts);
    await svc.list({ limit: 10, category: "goal" });
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("user_id=alex");
    expect(url).toContain("limit=10");
    expect(url).toContain("category=goal");
  });

  it("forget DELETEs the right URL", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    const svc = new Mem0MemoryService(baseOpts);
    await svc.forget("m_1");
    expect(String(fetchMock.mock.calls[0][0])).toBe("https://mem0.example.com/v1/memories/m_1/");
    expect((fetchMock.mock.calls[0][1] as RequestInit).method).toBe("DELETE");
  });

  it("wipe DELETEs with user_id", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    const svc = new Mem0MemoryService(baseOpts);
    await svc.wipe();
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("/v1/memories/?user_id=alex");
    expect((fetchMock.mock.calls[0][1] as RequestInit).method).toBe("DELETE");
  });

  it("health returns ok=false on failure with reason", async () => {
    fetchMock.mockResolvedValue(new Response("bad", { status: 500 }));
    const svc = new Mem0MemoryService(baseOpts);
    const r = await svc.health();
    expect(r.ok).toBe(false);
    expect(r.backend).toBe("mem0");
    expect(r.reason).toMatch(/HTTP 500/);
  });

  it("trims trailing slashes from serverUrl", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    const svc = new Mem0MemoryService({ ...baseOpts, serverUrl: "https://mem0.example.com///" });
    await svc.forget("x");
    expect(String(fetchMock.mock.calls[0][0])).toBe("https://mem0.example.com/v1/memories/x/");
  });

  it("auth circuit breaker: short-circuits after a 401 instead of hammering the server", async () => {
    // First call returns 401 → cool-down activates.
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: "Authentication required" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      })
    );
    const svc = new Mem0MemoryService(baseOpts);
    await expect(svc.add({ text: "hi", category: "goal" })).rejects.toThrow(/HTTP 401/);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Subsequent non-health calls do NOT hit the network.
    await expect(svc.add({ text: "hi 2", category: "goal" })).rejects.toThrow(/auth-failure backoff/);
    await expect(svc.search("anything")).rejects.toThrow(/auth-failure backoff/);
    await expect(svc.list()).rejects.toThrow(/auth-failure backoff/);
    expect(fetchMock).toHaveBeenCalledTimes(1); // still only the original 401
  });

  it("auth circuit breaker: /health is exempt from the backoff", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("nope", { status: 401 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "ok" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      );
    const svc = new Mem0MemoryService(baseOpts);
    await expect(svc.add({ text: "x", category: "goal" })).rejects.toThrow(/HTTP 401/);
    const h = await svc.health();
    expect(h.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("auth circuit breaker: a successful response clears the gate", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("nope", { status: 401 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "ok" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "m_1", memory: "ok" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      );
    const svc = new Mem0MemoryService(baseOpts);
    await expect(svc.add({ text: "x", category: "goal" })).rejects.toThrow(/HTTP 401/);
    // Health succeeds → gate clears.
    const h = await svc.health();
    expect(h.ok).toBe(true);
    // Subsequent non-health calls hit the network again.
    const item = await svc.add({ text: "y", category: "goal" });
    expect(item.id).toBe("m_1");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

describe("withMemoryGuard", () => {
  it("returns the value on success", async () => {
    const v = await withMemoryGuard(async () => 42, -1);
    expect(v).toBe(42);
  });
  it("returns the fallback on throw, never propagates", async () => {
    const v = await withMemoryGuard(async () => {
      throw new Error("boom");
    }, "fallback");
    expect(v).toBe("fallback");
  });
});
