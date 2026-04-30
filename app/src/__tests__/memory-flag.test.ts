import { describe, it, expect } from "vitest";
import { selectMemoryService, OfflineMemoryService, Mem0MemoryService } from "../memory";

/**
 * `selectMemoryService` is now a pure function — every input arrives as
 * an arg, no localStorage / runtime-cache reads. The previous version's
 * cache-vs-React-state race silently dropped users into offline mode
 * even when cognition was supposedly enabled. These tests pin down
 * the new contract.
 */
describe("selectMemoryService — pure args, no localStorage", () => {
  it("empty userId → OfflineMemoryService('anon')", () => {
    expect(
      selectMemoryService({ userId: "", serverUrl: "https://mem0.example.com", bearerToken: "tkn" })
    ).toBeInstanceOf(OfflineMemoryService);
    expect(
      selectMemoryService({ userId: "   ", serverUrl: "https://mem0.example.com", bearerToken: "tkn" })
    ).toBeInstanceOf(OfflineMemoryService);
  });

  it("forceOffline=true → OfflineMemoryService (per-user opt-out)", () => {
    expect(
      selectMemoryService({
        userId: "alex@gmail.com",
        serverUrl: "https://mem0.example.com",
        bearerToken: "tkn",
        forceOffline: true,
      })
    ).toBeInstanceOf(OfflineMemoryService);
  });

  it("empty serverUrl → OfflineMemoryService (degraded)", () => {
    expect(
      selectMemoryService({
        userId: "alex@gmail.com",
        serverUrl: "",
        bearerToken: "tkn",
      })
    ).toBeInstanceOf(OfflineMemoryService);
  });

  it("user + URL + bearer → Mem0MemoryService", () => {
    const svc = selectMemoryService({
      userId: "alex@gmail.com",
      serverUrl: "https://mem0.example.com",
      bearerToken: "session-jwt",
    });
    expect(svc).toBeInstanceOf(Mem0MemoryService);
    expect((svc as unknown as { apiKey: string }).apiKey).toBe("session-jwt");
  });

  it("user + URL but no bearer → Mem0MemoryService with no auth (caller's choice)", () => {
    const svc = selectMemoryService({
      userId: "alex@gmail.com",
      serverUrl: "https://mem0.example.com",
    });
    expect(svc).toBeInstanceOf(Mem0MemoryService);
  });
});
