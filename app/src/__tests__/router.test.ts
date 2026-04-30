import { describe, it, expect } from "vitest";
import { pathForView, sameView, viewFromPath } from "../store/router";
import type { View } from "../App";

describe("router — pathForView", () => {
  it("encodes simple views", () => {
    expect(pathForView({ name: "home" })).toBe("/");
    expect(pathForView({ name: "tasks" })).toBe("/tasks");
    expect(pathForView({ name: "dashboard" })).toBe("/dashboard");
    expect(pathForView({ name: "settings" })).toBe("/settings");
    expect(pathForView({ name: "leaderboard" })).toBe("/leaderboard");
    expect(pathForView({ name: "calibration" })).toBe("/calibration");
    expect(pathForView({ name: "memory" })).toBe("/memory");
    expect(pathForView({ name: "admin" })).toBe("/admin");
  });

  it("encodes topic and play views with their IDs", () => {
    expect(pathForView({ name: "topic", topicId: "ai-foundations" })).toBe("/topic/ai-foundations");
    expect(pathForView({ name: "play", topicId: "ai-foundations" })).toBe("/play/ai-foundations");
    expect(
      pathForView({ name: "play", topicId: "ai-foundations", levelId: "L1" })
    ).toBe("/play/ai-foundations/L1");
  });
});

describe("router — viewFromPath", () => {
  it("decodes simple paths", () => {
    expect(viewFromPath("/")).toEqual({ name: "home" });
    expect(viewFromPath("")).toEqual({ name: "home" });
    expect(viewFromPath("/tasks")).toEqual({ name: "tasks" });
    expect(viewFromPath("/dashboard")).toEqual({ name: "dashboard" });
    expect(viewFromPath("/settings")).toEqual({ name: "settings" });
    expect(viewFromPath("/leaderboard")).toEqual({ name: "leaderboard" });
    expect(viewFromPath("/calibration")).toEqual({ name: "calibration" });
    expect(viewFromPath("/memory")).toEqual({ name: "memory" });
    expect(viewFromPath("/admin")).toEqual({ name: "admin" });
  });

  it("decodes topic + play with IDs", () => {
    expect(viewFromPath("/topic/ai-foundations")).toEqual({
      name: "topic",
      topicId: "ai-foundations",
    });
    expect(viewFromPath("/play/ai-foundations")).toEqual({
      name: "play",
      topicId: "ai-foundations",
      levelId: undefined,
    });
    expect(viewFromPath("/play/ai-foundations/L3")).toEqual({
      name: "play",
      topicId: "ai-foundations",
      levelId: "L3",
    });
  });

  it("falls back to home for unknown / malformed paths", () => {
    expect(viewFromPath("/unknown")).toEqual({ name: "home" });
    expect(viewFromPath("/topic")).toEqual({ name: "home" }); // missing id
    expect(viewFromPath("/play")).toEqual({ name: "home" }); // missing id
    expect(viewFromPath("/foo/bar/baz")).toEqual({ name: "home" });
  });

  it("ignores trailing slashes and double slashes", () => {
    expect(viewFromPath("/dashboard/")).toEqual({ name: "dashboard" });
    expect(viewFromPath("//tasks//")).toEqual({ name: "tasks" });
  });
});

describe("router — sameView", () => {
  it("returns true when two views map to the same path", () => {
    const a: View = { name: "play", topicId: "ai-foundations", levelId: "L1" };
    const b: View = { name: "play", topicId: "ai-foundations", levelId: "L1" };
    expect(sameView(a, b)).toBe(true);
  });

  it("returns false when paths differ", () => {
    expect(sameView({ name: "home" }, { name: "dashboard" })).toBe(false);
    expect(
      sameView(
        { name: "play", topicId: "ai-foundations" },
        { name: "play", topicId: "ai-foundations", levelId: "L1" }
      )
    ).toBe(false);
  });
});

describe("router — round trip", () => {
  it("decode(encode(v)) === v for every concrete view", () => {
    const cases: View[] = [
      { name: "home" },
      { name: "tasks" },
      { name: "dashboard" },
      { name: "settings" },
      { name: "leaderboard" },
      { name: "calibration" },
      { name: "memory" },
      { name: "admin" },
      { name: "topic", topicId: "ai-foundations" },
      { name: "play", topicId: "ai-foundations", levelId: "L1" },
    ];
    for (const v of cases) {
      expect(viewFromPath(pathForView(v))).toEqual(v);
    }
  });
});
