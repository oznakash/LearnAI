import { describe, expect, it } from "vitest";
import { pathForView, viewFromPath } from "../store/router";

describe("router: /u/<handle> ↔ profile view", () => {
  it("decodes /u/maya into a profile view", () => {
    expect(viewFromPath("/u/maya")).toEqual({ name: "profile", handle: "maya" });
  });

  it("decodes percent-encoded handles", () => {
    expect(viewFromPath("/u/maya%2Dpatel")).toEqual({
      name: "profile",
      handle: "maya-patel",
    });
  });

  it("falls back to home if handle is missing", () => {
    expect(viewFromPath("/u")).toEqual({ name: "home" });
    expect(viewFromPath("/u/")).toEqual({ name: "home" });
  });

  it("encodes profile back to /u/<handle>", () => {
    expect(pathForView({ name: "profile", handle: "maya" })).toBe("/u/maya");
  });

  it("survives a round trip through both directions", () => {
    const v = { name: "profile" as const, handle: "ada-lovelace" };
    expect(viewFromPath(pathForView(v))).toEqual(v);
  });
});
