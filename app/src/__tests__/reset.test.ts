import { describe, it, expect, beforeEach } from "vitest";
import { eraseAllLocalData } from "../store/reset";
import { STORAGE_KEY } from "../store/game";
import { ADMIN_STORAGE_KEY } from "../admin/store";

describe("eraseAllLocalData", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("removes player + admin keys", () => {
    window.localStorage.setItem(STORAGE_KEY, "player-blob");
    window.localStorage.setItem(ADMIN_STORAGE_KEY, "admin-blob");
    eraseAllLocalData();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(window.localStorage.getItem(ADMIN_STORAGE_KEY)).toBeNull();
  });

  it("removes every per-user offline-memory blob", () => {
    window.localStorage.setItem("builderquest:memory:offline:alex@gmail.com", "[]");
    window.localStorage.setItem("builderquest:memory:offline:demo@gmail.com", "[]");
    window.localStorage.setItem("builderquest:memory:offline:anon", "[]");
    eraseAllLocalData();
    expect(window.localStorage.getItem("builderquest:memory:offline:alex@gmail.com")).toBeNull();
    expect(window.localStorage.getItem("builderquest:memory:offline:demo@gmail.com")).toBeNull();
    expect(window.localStorage.getItem("builderquest:memory:offline:anon")).toBeNull();
  });

  it("removes every per-user offline-social blob", () => {
    window.localStorage.setItem("learnai:social:offline:alex@gmail.com", "{}");
    window.localStorage.setItem("learnai:social:offline:maya@gmail.com", "{}");
    eraseAllLocalData();
    expect(window.localStorage.getItem("learnai:social:offline:alex@gmail.com")).toBeNull();
    expect(window.localStorage.getItem("learnai:social:offline:maya@gmail.com")).toBeNull();
  });

  it("leaves unrelated keys untouched", () => {
    window.localStorage.setItem("some-other-app:state", "keep-me");
    window.localStorage.setItem("builderquest:memory:offline:alex@gmail.com", "[]");
    eraseAllLocalData();
    expect(window.localStorage.getItem("some-other-app:state")).toBe("keep-me");
    expect(window.localStorage.getItem("builderquest:memory:offline:alex@gmail.com")).toBeNull();
  });
});
