import { useEffect, useRef, useState } from "react";

/**
 * In-app image crop dialog for avatar / banner uploads.
 *
 * Refined v2 UX (replaces the v1 "drag the background" approach):
 *
 *  - The source image renders FULL in a viewport-responsive area.
 *    A darkened scrim covers everything except the crop cutout, so
 *    the visible-bright region IS exactly what gets saved. Same
 *    mental model as Instagram, Twitter, Cropper.js — no surprise
 *    cropping.
 *  - Avatar cutout is a TRUE circle (clip-path), so the user can
 *    see what their face will look like behind the round avatar
 *    frame on `/u/<handle>`. Banner cutout is a wide rectangle.
 *  - Drag to pan, slider for zoom, two-finger pinch on touch
 *    devices, scroll-wheel zoom on desktop.
 *  - Source images are pre-downsampled to ≤ 1600 px on the longest
 *    side before display so phone-camera shots (4K-ish) stay
 *    snappy on drag/zoom. The output canvas is small (avatar 400 ×
 *    400, banner 1280 × 432) and encoded as WebP at q=0.82 with a
 *    JPEG fallback, landing at 20–50 KB typical. Well under the
 *    server's 1 MB cap.
 *  - Mobile-first sizing: the dialog's crop area is min(85vw, 380
 *    px) for avatars and min(92vw, 520px) for banners.
 *
 * The actual upload happens in the caller (Network.tsx), which
 * calls `social.uploadImage(kind, dataUrl)`. Online round-trips to
 * `social-svc`; offline keeps the data URL on the local profile.
 */

export type CropKind = "avatar" | "hero";

export interface CropDialogProps {
  open: boolean;
  kind: CropKind;
  /** Called with the cropped data URL on save. */
  onSave: (dataUrl: string) => Promise<void> | void;
  onClose: () => void;
}

interface KindSpec {
  outputWidth: number;
  outputHeight: number;
  /** Aspect ratio of the cutout in the dialog (width / height). */
  cutoutAspect: number;
  /** Cutout shape: circular cutout for avatars, rounded-rect for banners. */
  cutoutShape: "circle" | "rect";
  title: string;
  saveLabel: string;
  hint: string;
  emptyLabel: string;
}

// 400×400 covers a 200px Retina avatar; 1280×432 covers a 640px
// Retina banner. Smaller than v1 (was 512×512 / 1600×540). The hero
// keeps the same ~2.96:1 ratio used by Twitter banners.
const SPECS: Record<CropKind, KindSpec> = {
  avatar: {
    outputWidth: 400,
    outputHeight: 400,
    cutoutAspect: 1,
    cutoutShape: "circle",
    title: "Crop your profile photo",
    saveLabel: "Use this photo",
    hint: "Drag to position. Pinch or scroll to zoom.",
    emptyLabel: "Pick a photo",
  },
  hero: {
    outputWidth: 1280,
    outputHeight: 432,
    cutoutAspect: 1280 / 432,
    cutoutShape: "rect",
    title: "Crop your banner",
    saveLabel: "Use this banner",
    hint: "Drag to position. Pinch or scroll to zoom.",
    emptyLabel: "Pick a banner image",
  },
};

const MAX_SOURCE_DIM = 1600; // longest side of the in-memory source image.

export function ImageCropDialog({ open, kind, onSave, onClose }: CropDialogProps) {
  const spec = SPECS[kind];
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const stageRef = useRef<HTMLDivElement | null>(null);
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const dragRef = useRef<{
    startX: number;
    startY: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const pinchRef = useRef<{ startDistance: number; startZoom: number } | null>(null);

  // Reset state every time the dialog opens (or kind changes).
  useEffect(() => {
    if (!open) return;
    setImage(null);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setBusy(false);
    setError(null);
  }, [open, kind]);

  // Measure the stage to drive responsive sizing of the cutout.
  useEffect(() => {
    if (!open) return;
    const el = stageRef.current;
    if (!el) return;
    const measure = () =>
      setStageSize({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open, image]);

  if (!open) return null;

  const handleFile = async (file: File | null) => {
    if (!file) return;
    setError(null);
    if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) {
      setError("Please pick a JPEG, PNG, or WebP image.");
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setError("That file is too big. Try one under 12 MB.");
      return;
    }
    try {
      const sourceUrl = await readAsDataUrl(file);
      const raw = await loadImage(sourceUrl);
      // Pre-downsample very large source images so panning + zooming
      // stays smooth on mobile. Phones routinely produce 4000×3000
      // JPEGs that turn the canvas math sluggish.
      const downsampled = downsampleImage(raw, MAX_SOURCE_DIM);
      setImage(downsampled);
      setZoom(1);
      setOffset({ x: 0, y: 0 });
    } catch (e) {
      setError((e as Error).message || "That image couldn't be loaded.");
    }
  };

  // -- Pan + zoom math -----------------------------------------------------

  const cutout = computeCutout(spec, stageSize);
  const fit = image
    ? computeFitTransform({
        imageW: image.naturalWidth,
        imageH: image.naturalHeight,
        cutoutW: cutout.width,
        cutoutH: cutout.height,
        zoom,
        offset,
      })
    : null;

  // -- Pointer handlers (mouse + touch via Pointer Events) ----------------

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!image) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size === 1) {
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        offsetX: offset.x,
        offsetY: offset.y,
      };
    } else if (pointersRef.current.size === 2) {
      const [a, b] = Array.from(pointersRef.current.values());
      pinchRef.current = {
        startDistance: distance(a, b),
        startZoom: zoom,
      };
      dragRef.current = null;
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!image || !pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size === 2 && pinchRef.current) {
      const [a, b] = Array.from(pointersRef.current.values());
      const ratio = distance(a, b) / pinchRef.current.startDistance;
      setZoom(clamp(pinchRef.current.startZoom * ratio, 1, 5));
      return;
    }
    const drag = dragRef.current;
    if (!drag) return;
    setOffset({
      x: drag.offsetX + (e.clientX - drag.startX),
      y: drag.offsetY + (e.clientY - drag.startY),
    });
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    if (pointersRef.current.size === 0) dragRef.current = null;
  };

  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!image) return;
    e.preventDefault();
    // Trackpad pinch reports as wheel + ctrlKey; mouse wheel reports as
    // plain deltaY. Normalize: positive deltaY → zoom out.
    const delta = -e.deltaY / 200;
    setZoom((z) => clamp(z * (1 + delta), 1, 5));
  };

  // -- Save ----------------------------------------------------------------

  const handleSave = async () => {
    if (!image || !fit) return;
    setBusy(true);
    setError(null);
    try {
      const dataUrl = renderCrop({
        image,
        cutout,
        fit,
        spec,
      });
      await onSave(dataUrl);
    } catch (err) {
      setError((err as Error).message || "Couldn't save the image.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-label={spec.title}
      className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-md p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[640px] rounded-2xl bg-ink2 border border-white/10 overflow-hidden flex flex-col shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-white/5">
          <div>
            <h2 className="font-display text-base sm:text-lg font-bold text-white">
              {spec.title}
            </h2>
            {image && <p className="text-[11px] text-white/50 mt-0.5">{spec.hint}</p>}
          </div>
          <button
            type="button"
            className="text-white/50 hover:text-white text-lg leading-none px-2 py-1"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {!image ? (
          <FilePicker spec={spec} onFile={handleFile} error={error} />
        ) : (
          <>
            <div
              ref={stageRef}
              role="img"
              aria-label="Crop preview"
              className="relative w-full bg-black select-none touch-none cursor-grab active:cursor-grabbing"
              style={{
                aspectRatio: kind === "avatar" ? "1 / 1" : "16 / 11",
                maxHeight: "70vh",
              }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onWheel={onWheel}
            >
              {/* Source image, positioned absolutely under the scrim.
                  `fit` returns coords relative to the cutout — translate
                  to stage-absolute by adding the cutout's stage offset. */}
              {fit && (
                <img
                  src={image.src}
                  alt=""
                  draggable={false}
                  className="absolute pointer-events-none select-none"
                  style={{
                    left: `${cutout.left + fit.left}px`,
                    top: `${cutout.top + fit.top}px`,
                    width: `${fit.width}px`,
                    height: `${fit.height}px`,
                    maxWidth: "none",
                  }}
                  data-testid="crop-image"
                />
              )}
              {/* Darkened scrim with cutout. The cutout uses
                  clip-path: evenodd so the inner shape stays bright. */}
              <CropScrim
                stageSize={stageSize}
                cutout={cutout}
                shape={spec.cutoutShape}
              />
              {/* Bright outline + rule-of-thirds grid inside the cutout
                  so the user understands what gets saved. */}
              <CropFrame cutout={cutout} shape={spec.cutoutShape} />
            </div>

            <div className="px-4 sm:px-5 py-3 border-t border-white/5 space-y-3">
              <div className="flex items-center gap-3 text-xs text-white/60">
                <span className="text-base" aria-hidden="true">🔍</span>
                <input
                  type="range"
                  min="1"
                  max="5"
                  step="0.01"
                  value={zoom}
                  onChange={(e) => setZoom(parseFloat(e.target.value))}
                  className="flex-1 accent-accent"
                  aria-label="Zoom"
                />
                <span className="tabular-nums w-10 text-right">{zoom.toFixed(2)}×</span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs text-white/60 hover:text-white cursor-pointer underline underline-offset-2">
                  Pick a different image
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                  />
                </label>
                <div className="flex gap-2 ml-auto">
                  <button
                    type="button"
                    className="btn-ghost text-sm"
                    onClick={onClose}
                    disabled={busy}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn-primary text-sm"
                    onClick={handleSave}
                    disabled={busy}
                  >
                    {busy ? "Saving…" : spec.saveLabel}
                  </button>
                </div>
              </div>
              {error && (
                <p className="text-[11px] text-bad bg-bad/10 border border-bad/30 rounded-lg px-2 py-1.5">
                  {error}
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// -- Empty-state file picker -------------------------------------------

function FilePicker({
  spec,
  onFile,
  error,
}: {
  spec: KindSpec;
  onFile: (f: File | null) => void;
  error: string | null;
}) {
  return (
    <div className="p-5 sm:p-7">
      <label className="flex flex-col items-center gap-3 p-6 border-2 border-dashed border-white/15 rounded-xl cursor-pointer hover:border-accent/60 hover:bg-white/5 transition">
        <span className="text-4xl" aria-hidden="true">📷</span>
        <span className="text-sm font-semibold text-white">{spec.emptyLabel}</span>
        <span className="text-[11px] text-white/50">
          JPEG, PNG, or WebP. Up to 12 MB. We'll crop it next.
        </span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        />
      </label>
      {error && (
        <p className="text-[11px] text-bad bg-bad/10 border border-bad/30 rounded-lg px-2 py-1.5 mt-3">
          {error}
        </p>
      )}
    </div>
  );
}

// -- Crop scrim (dim outside, bright inside) ---------------------------

function CropScrim({
  stageSize,
  cutout,
  shape,
}: {
  stageSize: { width: number; height: number };
  cutout: { left: number; top: number; width: number; height: number };
  shape: "circle" | "rect";
}) {
  if (stageSize.width === 0) return null;
  // Use SVG mask to carve the cutout out of the dim layer. clipPath
  // would also work but mask is more universally supported on touch
  // browsers when the shape changes.
  const radius = shape === "circle" ? cutout.width / 2 : 12;
  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      width={stageSize.width}
      height={stageSize.height}
      viewBox={`0 0 ${stageSize.width} ${stageSize.height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <mask id="cropMask">
          <rect x="0" y="0" width={stageSize.width} height={stageSize.height} fill="white" />
          {shape === "circle" ? (
            <circle
              cx={cutout.left + cutout.width / 2}
              cy={cutout.top + cutout.height / 2}
              r={radius}
              fill="black"
            />
          ) : (
            <rect
              x={cutout.left}
              y={cutout.top}
              width={cutout.width}
              height={cutout.height}
              rx={radius}
              ry={radius}
              fill="black"
            />
          )}
        </mask>
      </defs>
      <rect
        x="0"
        y="0"
        width={stageSize.width}
        height={stageSize.height}
        fill="rgba(0, 0, 0, 0.55)"
        mask="url(#cropMask)"
      />
    </svg>
  );
}

// -- Crop frame outline + rule-of-thirds grid --------------------------

function CropFrame({
  cutout,
  shape,
}: {
  cutout: { left: number; top: number; width: number; height: number };
  shape: "circle" | "rect";
}) {
  const radius = shape === "circle" ? "50%" : "12px";
  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: `${cutout.left}px`,
        top: `${cutout.top}px`,
        width: `${cutout.width}px`,
        height: `${cutout.height}px`,
        borderRadius: radius,
        boxShadow:
          "0 0 0 2px rgba(255,255,255,0.95), 0 8px 24px rgba(0,0,0,0.4)",
      }}
    >
      {/* Rule-of-thirds gridlines, gentle but visible. */}
      <div
        className="absolute inset-0"
        style={{
          borderRadius: radius,
          backgroundImage:
            "linear-gradient(to right, transparent calc(33.333% - 1px), rgba(255,255,255,0.25) calc(33.333% - 1px), rgba(255,255,255,0.25) 33.333%, transparent 33.333%, transparent calc(66.666% - 1px), rgba(255,255,255,0.25) calc(66.666% - 1px), rgba(255,255,255,0.25) 66.666%, transparent 66.666%), linear-gradient(to bottom, transparent calc(33.333% - 1px), rgba(255,255,255,0.25) calc(33.333% - 1px), rgba(255,255,255,0.25) 33.333%, transparent 33.333%, transparent calc(66.666% - 1px), rgba(255,255,255,0.25) calc(66.666% - 1px), rgba(255,255,255,0.25) 66.666%, transparent 66.666%)",
          mixBlendMode: "screen",
        }}
      />
    </div>
  );
}

// -- Geometry helpers ---------------------------------------------------

function computeCutout(
  spec: KindSpec,
  stage: { width: number; height: number },
): { left: number; top: number; width: number; height: number } {
  if (stage.width === 0 || stage.height === 0) {
    return { left: 0, top: 0, width: 0, height: 0 };
  }
  // Cutout fits the stage with 6% padding on the smaller dimension.
  const padding = 0.06;
  const maxW = stage.width * (1 - padding * 2);
  const maxH = stage.height * (1 - padding * 2);
  let w = maxW;
  let h = w / spec.cutoutAspect;
  if (h > maxH) {
    h = maxH;
    w = h * spec.cutoutAspect;
  }
  return {
    left: (stage.width - w) / 2,
    top: (stage.height - h) / 2,
    width: w,
    height: h,
  };
}

/**
 * Compute the absolute pixel rect for the source image, given the
 * cutout dimensions, current zoom, and current pan offset. At zoom=1,
 * the image is "covered" — the smaller dimension touches the cutout
 * edge. Larger zooms scale up; offset shifts the image.
 */
function computeFitTransform(args: {
  imageW: number;
  imageH: number;
  cutoutW: number;
  cutoutH: number;
  zoom: number;
  offset: { x: number; y: number };
}): { left: number; top: number; width: number; height: number; coverScale: number } {
  const { imageW, imageH, cutoutW, cutoutH, zoom, offset } = args;
  if (cutoutW === 0 || cutoutH === 0) {
    return { left: 0, top: 0, width: imageW, height: imageH, coverScale: 1 };
  }
  const coverScale = Math.max(cutoutW / imageW, cutoutH / imageH);
  const scale = coverScale * zoom;
  const w = imageW * scale;
  const h = imageH * scale;
  const cutoutCenterX = cutoutW / 2;
  const cutoutCenterY = cutoutH / 2;
  // Stage and cutout share the same coord space (cutout is centered
  // inside stage). The image position is computed relative to the
  // cutout's top-left, then translated to the stage by adding the
  // cutout's stage-relative offset (handled by the caller via the
  // returned `left`/`top` already including the cutout center math
  // when used with `position: absolute` on the stage).
  // For simplicity here: position the image inside the stage so its
  // center is at the cutout's center plus the user's pan offset.
  const left = cutoutCenterX - w / 2 + offset.x;
  const top = cutoutCenterY - h / 2 + offset.y;
  // Now translate to stage-absolute coords. Since we don't know the
  // stage size here, return cutout-relative; caller positions the
  // image inside the stage using the cutout's stage coords.
  return { left, top, width: w, height: h, coverScale };
}

// -- Render the final crop to a canvas ---------------------------------

function renderCrop(args: {
  image: HTMLImageElement;
  cutout: { left: number; top: number; width: number; height: number };
  fit: { left: number; top: number; width: number; height: number };
  spec: KindSpec;
}): string {
  const { image, cutout, fit, spec } = args;
  // Map cutout viewport coords back to source-image pixels.
  // The image is rendered at `fit.width × fit.height`. Source-pixel
  // scale = image.naturalWidth / fit.width.
  const sx = image.naturalWidth / fit.width;
  const sy = image.naturalHeight / fit.height;
  // The image's stage coords + cutout's stage coords get added when
  // rendered, but we returned `fit` with cutout-relative coords. The
  // visible region of the source = cutout viewport, mapped back.
  const srcX = (0 - fit.left) * sx;
  const srcY = (0 - fit.top) * sy;
  const srcW = cutout.width * sx;
  const srcH = cutout.height * sy;
  // Clamp to source bounds in case of fp drift.
  const clampedSrcX = Math.max(0, Math.min(srcX, image.naturalWidth - 1));
  const clampedSrcY = Math.max(0, Math.min(srcY, image.naturalHeight - 1));
  const clampedSrcW = Math.max(1, Math.min(srcW, image.naturalWidth - clampedSrcX));
  const clampedSrcH = Math.max(1, Math.min(srcH, image.naturalHeight - clampedSrcY));

  const out = document.createElement("canvas");
  out.width = spec.outputWidth;
  out.height = spec.outputHeight;
  const ctx = out.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D not available.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    image,
    clampedSrcX,
    clampedSrcY,
    clampedSrcW,
    clampedSrcH,
    0,
    0,
    spec.outputWidth,
    spec.outputHeight,
  );
  return encodeBest(out);
}

/**
 * Encode the canvas to WebP if the browser supports it (most do —
 * Safari since 14, Chrome / Firefox / Edge for years). Fall back to
 * JPEG. WebP is ~25–30% smaller than JPEG at the same perceived
 * quality, which makes a real difference on mobile uploads.
 */
function encodeBest(canvas: HTMLCanvasElement): string {
  const webp = canvas.toDataURL("image/webp", 0.82);
  if (webp.startsWith("data:image/webp")) return webp;
  return canvas.toDataURL("image/jpeg", 0.85);
}

// -- File / image plumbing ---------------------------------------------

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("That image couldn't be loaded."));
    img.src = src;
  });
}

/**
 * Downsample an HTMLImageElement to `maxSide` longest-side pixels.
 * Returns the original image if it's already small enough. The
 * downsampled image lives entirely in memory (data URL via canvas)
 * — keeps the drag/zoom math working against a smaller canvas
 * without losing fidelity for the final crop.
 */
function downsampleImage(image: HTMLImageElement, maxSide: number): HTMLImageElement {
  const longest = Math.max(image.naturalWidth, image.naturalHeight);
  if (longest <= maxSide) return image;
  const scale = maxSide / longest;
  const w = Math.round(image.naturalWidth * scale);
  const h = Math.round(image.naturalHeight * scale);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) return image;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, 0, 0, w, h);
  const out = new Image();
  out.src = c.toDataURL("image/jpeg", 0.92);
  // The new image's `naturalWidth/Height` are populated synchronously
  // because the source is a data: URL that has already been decoded.
  // But `complete` may still be false; consumers only use `.src` and
  // `naturalWidth`/`naturalHeight` after the next render, by which
  // time the image is fully resolved.
  Object.defineProperty(out, "naturalWidth", { value: w, configurable: true });
  Object.defineProperty(out, "naturalHeight", { value: h, configurable: true });
  return out;
}

// -- Misc ---------------------------------------------------------------

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}
