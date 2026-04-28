/**
 * Best-effort suppression of in-page zoom gestures.
 *
 * This is *only* about gesture-based zoom (trackpad pinch, double-tap,
 * Safari's gesture events). We deliberately do NOT block keyboard zoom
 * (Ctrl/Cmd +/-/0) — that's a system-level browser feature and blocking
 * it would harm accessibility.
 *
 * Mobile pinch is blocked by the viewport meta + CSS `touch-action`
 * already; this catches the desktop / trackpad cases.
 */

let installed = false;

export function disablePageZoomGestures() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  // Trackpad / mouse pinch on Chrome, Edge, Firefox: emits wheel events
  // with ctrlKey === true. Block at the document level.
  const onWheel = (e: WheelEvent) => {
    if (e.ctrlKey) e.preventDefault();
  };
  window.addEventListener("wheel", onWheel, { passive: false });

  // Safari pinch: gesturestart / gesturechange / gestureend.
  type GestureEventLike = Event;
  const swallow = (e: GestureEventLike) => e.preventDefault();
  window.addEventListener("gesturestart", swallow as EventListener);
  window.addEventListener("gesturechange", swallow as EventListener);
  window.addEventListener("gestureend", swallow as EventListener);

  // iOS Safari double-tap to zoom: detect two taps within 300ms, then
  // preventDefault on the second. Doesn't break normal taps because we
  // only act on the *second* one.
  let lastTouchEnd = 0;
  document.addEventListener(
    "touchend",
    (e) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) e.preventDefault();
      lastTouchEnd = now;
    },
    { passive: false }
  );
}
