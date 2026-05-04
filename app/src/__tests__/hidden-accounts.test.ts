import { describe, it, expect } from "vitest";
import {
  isHiddenAccount,
  isHiddenHandle,
  listHiddenAccountEmails,
} from "../lib/hidden-accounts";
import { baseHandleFromEmail } from "../social/handles";

describe("hidden-accounts", () => {
  describe("isHiddenAccount", () => {
    it("returns true for known QA emails (exact, case-insensitive, with whitespace)", () => {
      expect(isHiddenAccount("learnai-qa+maya@gmail.com")).toBe(true);
      expect(isHiddenAccount("LEARNAI-QA+MAYA@GMAIL.COM")).toBe(true);
      expect(isHiddenAccount("  learnai-qa+maya@gmail.com  ")).toBe(true);
    });

    it("returns false for normal emails", () => {
      expect(isHiddenAccount("alex@gmail.com")).toBe(false);
      expect(isHiddenAccount("learnai-qa+nope@gmail.com")).toBe(false);
    });

    it("returns false for empty / nullish", () => {
      expect(isHiddenAccount(undefined)).toBe(false);
      expect(isHiddenAccount(null)).toBe(false);
      expect(isHiddenAccount("")).toBe(false);
    });
  });

  describe("isHiddenHandle", () => {
    it("matches the canonical handle each hidden email collapses to", () => {
      for (const email of listHiddenAccountEmails()) {
        const handle = baseHandleFromEmail(email);
        expect(isHiddenHandle(handle), `expected ${handle} to be hidden`).toBe(
          true,
        );
      }
    });

    it("is case-insensitive", () => {
      const handle = baseHandleFromEmail(listHiddenAccountEmails()[0]);
      expect(isHiddenHandle(handle.toUpperCase())).toBe(true);
    });

    it("returns false for normal handles", () => {
      expect(isHiddenHandle("alex")).toBe(false);
      expect(isHiddenHandle("maya")).toBe(false);
    });

    it("returns false for empty / nullish", () => {
      expect(isHiddenHandle(undefined)).toBe(false);
      expect(isHiddenHandle(null)).toBe(false);
      expect(isHiddenHandle("")).toBe(false);
    });
  });
});
