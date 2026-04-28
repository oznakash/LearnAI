import { describe, it, expect, beforeEach } from "vitest";
import { disablePageZoomGestures } from "../lib/no-zoom";

describe("disablePageZoomGestures", () => {
  beforeEach(() => {
    disablePageZoomGestures();
  });

  it("preventDefaults a wheel event with ctrlKey", () => {
    const e = new WheelEvent("wheel", { ctrlKey: true, cancelable: true });
    window.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true);
  });

  it("does NOT preventDefault a normal wheel event (no ctrl)", () => {
    const e = new WheelEvent("wheel", { ctrlKey: false, cancelable: true });
    window.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(false);
  });

  it("preventDefaults Safari gesturestart", () => {
    const e = new Event("gesturestart", { cancelable: true });
    window.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true);
  });

  it("can be installed twice safely (idempotent)", () => {
    disablePageZoomGestures();
    disablePageZoomGestures();
    const e = new WheelEvent("wheel", { ctrlKey: true, cancelable: true });
    window.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true);
  });
});
