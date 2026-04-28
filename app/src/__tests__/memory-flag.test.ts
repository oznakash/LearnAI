import { describe, it, expect, beforeEach } from "vitest";
import { selectMemoryService } from "../memory";
import { OfflineMemoryService, Mem0MemoryService } from "../memory";
import { ADMIN_STORAGE_KEY } from "../admin/store";
import { _resetRuntimeCache } from "../admin/runtime";

beforeEach(() => {
  localStorage.clear();
  _resetRuntimeCache();
});

describe("offline flag selects the active MemoryService", () => {
  it("offline=true → OfflineMemoryService", () => {
    localStorage.setItem(
      ADMIN_STORAGE_KEY,
      JSON.stringify({ flags: { offlineMode: true }, memoryConfig: { serverUrl: "https://mem0.example.com", apiKey: "x" } })
    );
    _resetRuntimeCache();
    const svc = selectMemoryService("alex@gmail.com");
    expect(svc).toBeInstanceOf(OfflineMemoryService);
  });

  it("offline=false + serverUrl set → Mem0MemoryService", () => {
    localStorage.setItem(
      ADMIN_STORAGE_KEY,
      JSON.stringify({ flags: { offlineMode: false }, memoryConfig: { serverUrl: "https://mem0.example.com", apiKey: "x" } })
    );
    _resetRuntimeCache();
    const svc = selectMemoryService("alex@gmail.com");
    expect(svc).toBeInstanceOf(Mem0MemoryService);
  });

  it("offline=false but no server URL → degrade silently to Offline", () => {
    localStorage.setItem(
      ADMIN_STORAGE_KEY,
      JSON.stringify({ flags: { offlineMode: false }, memoryConfig: { serverUrl: "", apiKey: "" } })
    );
    _resetRuntimeCache();
    const svc = selectMemoryService("alex@gmail.com");
    expect(svc).toBeInstanceOf(OfflineMemoryService);
  });

  it("no admin config at all → OfflineMemoryService (safe default)", () => {
    const svc = selectMemoryService("alex@gmail.com");
    expect(svc).toBeInstanceOf(OfflineMemoryService);
  });

  it("toggling the flag returns a different service on the next call (no React state)", () => {
    localStorage.setItem(
      ADMIN_STORAGE_KEY,
      JSON.stringify({ flags: { offlineMode: true }, memoryConfig: { serverUrl: "https://mem0.example.com", apiKey: "x" } })
    );
    _resetRuntimeCache();
    expect(selectMemoryService("alex@gmail.com")).toBeInstanceOf(OfflineMemoryService);

    localStorage.setItem(
      ADMIN_STORAGE_KEY,
      JSON.stringify({ flags: { offlineMode: false }, memoryConfig: { serverUrl: "https://mem0.example.com", apiKey: "x" } })
    );
    _resetRuntimeCache();
    expect(selectMemoryService("alex@gmail.com")).toBeInstanceOf(Mem0MemoryService);
  });
});
