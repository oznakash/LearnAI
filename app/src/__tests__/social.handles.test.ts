import { describe, expect, it } from "vitest";
import {
  baseHandleFromEmail,
  disambiguateHandle,
  firstNameFrom,
  isValidHandle,
  resolveDisplayName,
} from "../social/handles";

describe("baseHandleFromEmail", () => {
  it("strips the local part to lowercase ascii", () => {
    expect(baseHandleFromEmail("Maya@gmail.com")).toBe("maya");
    expect(baseHandleFromEmail("MAYA.PATEL@example.com")).toBe("mayapatel");
  });

  it("collapses dots — Gmail dot-insensitivity", () => {
    expect(baseHandleFromEmail("m.a.y.a@gmail.com")).toBe("maya");
    expect(baseHandleFromEmail("maya@gmail.com")).toBe("maya");
  });

  it("preserves underscores and hyphens; collapses runs", () => {
    expect(baseHandleFromEmail("ada_lovelace@x.com")).toBe("ada_lovelace");
    expect(baseHandleFromEmail("ada__lovelace@x.com")).toBe("ada-lovelace");
    expect(baseHandleFromEmail("a-b-c@x.com")).toBe("a-b-c");
  });

  it("trims leading/trailing separators", () => {
    expect(baseHandleFromEmail("_alex@x.com")).toBe("alex");
    expect(baseHandleFromEmail("alex_@x.com")).toBe("alex");
  });

  it("caps to 24 chars", () => {
    const long = "a".repeat(50);
    const handle = baseHandleFromEmail(`${long}@x.com`);
    expect(handle.length).toBe(24);
    expect(handle).toBe("a".repeat(24));
  });

  it("falls back to 'user' when local-part has no usable chars", () => {
    expect(baseHandleFromEmail("...@x.com")).toBe("user");
    expect(baseHandleFromEmail("@x.com")).toBe("user");
  });
});

describe("disambiguateHandle", () => {
  it("returns base when free", () => {
    expect(disambiguateHandle("maya", () => false)).toBe("maya");
  });

  it("appends 2, 3, ... when collisions exist", () => {
    const taken = new Set(["maya", "maya2", "maya3"]);
    expect(disambiguateHandle("maya", (h) => taken.has(h))).toBe("maya4");
  });

  it("returns null after exhausting 9999 candidates", () => {
    expect(disambiguateHandle("maya", () => true)).toBeNull();
  });
});

describe("isValidHandle", () => {
  it("accepts URL-safe lowercase ascii", () => {
    expect(isValidHandle("maya")).toBe(true);
    expect(isValidHandle("ada_lovelace")).toBe(true);
    expect(isValidHandle("ada-lovelace-2")).toBe(true);
  });

  it("rejects empty / too long / wrong case / leading sep", () => {
    expect(isValidHandle("")).toBe(false);
    expect(isValidHandle("Maya")).toBe(false);
    expect(isValidHandle("a".repeat(25))).toBe(false);
    expect(isValidHandle("-alex")).toBe(false);
    expect(isValidHandle("alex_")).toBe(false);
    expect(isValidHandle("alex@")).toBe(false);
  });
});

describe("display-name helpers", () => {
  it("firstNameFrom uses first token of fullName when available", () => {
    expect(firstNameFrom("Maya Patel", "maya@x.com")).toBe("Maya");
  });

  it("firstNameFrom falls back to capitalized handle when fullName is empty", () => {
    expect(firstNameFrom(undefined, "maya@x.com")).toBe("Maya");
    expect(firstNameFrom("", "ada-lovelace@x.com")).toBe("Ada-lovelace");
  });

  it("resolveDisplayName returns full when showFullName=true and full is set", () => {
    expect(
      resolveDisplayName({ fullName: "Maya Patel", showFullName: true, email: "maya@x.com" }),
    ).toBe("Maya Patel");
  });

  it("resolveDisplayName falls back to first when showFullName=false", () => {
    expect(
      resolveDisplayName({ fullName: "Maya Patel", showFullName: false, email: "maya@x.com" }),
    ).toBe("Maya");
  });

  it("resolveDisplayName returns first when fullName is missing even if showFullName=true", () => {
    expect(resolveDisplayName({ showFullName: true, email: "maya@x.com" })).toBe("Maya");
  });
});
