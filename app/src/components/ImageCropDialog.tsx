import { useEffect, useRef, useState } from "react";

/**
 * In-app image crop dialog for avatar / hero uploads.
 *
 * Why this lives in `app/src/components/`:
 *   - The operator wanted upload + crop NOW, before the CDN sprint.
 *   - Adding a third-party react-image-crop dependency would expand
 *     the bundle and the dependency surface for one feature. This
 *     component is ~250 LOC of plain canvas + pointer events, no
 *     deps, and produces a `data:image/jpeg;base64,…` URL the caller
 *     POSTs straight to `/v1/social/me/image/<kind>` (or hands to
 *     the offline service for local preview).
 *
 * UX shape:
 *   - File picker (native `<input type="file">` styled as a button).
 *   - Once a file is loaded: a square or wide viewport (depending on
 *     `kind`) shows the image with a fixed crop frame. The user
 *     drags to position and uses a zoom slider. No freeform crop —
 *     the aspect ratio is locked to the target.
 *   - "Save" reads the cropped region into a hidden `<canvas>`,
 *     resamples to the target output size, encodes JPEG q=0.85, and
 *     resolves with the `data:image/jpeg;base64,…` URL.
 *
 * The actual upload happens in the caller (Network.tsx), which calls
 * `social.uploadImage(kind, dataUrl)`. Online mode round-trips to
 * social-svc and gets back a same-origin URL; offline keeps the data
 * URL straight on the local profile.
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
  /** Output pixel dimensions of the cropped, encoded image. */
  outputWidth: number;
  outputHeight: number;
  /** Display aspect-ratio of the crop frame in the dialog. */
  frameAspect: number;
  /** Title shown to the user. */
  title: string;
  /** Hint shown beneath the file picker. */
  hint: string;
  /** "Choose a profile picture" / "Choose a banner". */
  chooseLabel: string;
}

// Output sizes are tuned for "small enough to fit the 1 MB upload
// cap; large enough to not look fuzzy on a Retina display." Hero is
// wider than square because the body uses it as a banner above the
// avatar.
const SPECS: Record<CropKind, KindSpec> = {
  avatar: {
    outputWidth: 512,
    outputHeight: 512,
    frameAspect: 1,
    title: "Choose a profile picture",
    hint: "Drag to reposition · use the zoom slider · save when it looks right.",
    chooseLabel: "Choose a profile picture",
  },
  hero: {
    outputWidth: 1600,
    outputHeight: 540,
    // 1600 / 540 ≈ 2.96 — wide banner above the profile.
    frameAspect: 1600 / 540,
    title: "Choose a banner image",
    hint: "Wide format — drag to reposition · zoom · save.",
    chooseLabel: "Choose a banner image",
  },
};

export function ImageCropDialog({ open, kind, onSave, onClose }: CropDialogProps) {
  const spec = SPECS[kind];
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef<{ startX: number; startY: number; offsetX: number; offsetY: number } | null>(null);

  // Reset state every time the dialog opens (or kind changes).
  useEffect(() => {
    if (!open) return;
    setImage(null);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setBusy(false);
    setError(null);
  }, [open, kind]);

  if (!open) return null;

  const handleFile = (file: File | null) => {
    if (!file) return;
    setError(null);
    if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) {
      setError("Please pick a JPEG, PNG, or WebP image.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("That file is too big. Try one under 8 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const url = String(e.target?.result ?? "");
      const img = new Image();
      img.onload = () => {
        setImage(img);
        setZoom(1);
        setOffset({ x: 0, y: 0 });
      };
      img.onerror = () => setError("That image couldn't be loaded.");
      img.src = url;
    };
    reader.onerror = () => setError("Couldn't read that file.");
    reader.readAsDataURL(file);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!image) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    draggingRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      offsetX: offset.x,
      offsetY: offset.y,
    };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = draggingRef.current;
    if (!drag || !image) return;
    setOffset({
      x: drag.offsetX + (e.clientX - drag.startX),
      y: drag.offsetY + (e.clientY - drag.startY),
    });
  };

  const onPointerUp = () => {
    draggingRef.current = null;
  };

  const handleSave = async () => {
    if (!image || !previewRef.current) return;
    setBusy(true);
    setError(null);
    try {
      const dataUrl = renderCrop({
        image,
        previewRect: previewRef.current.getBoundingClientRect(),
        offset,
        zoom,
        spec,
      });
      await onSave(dataUrl);
    } catch (err) {
      setError((err as Error).message || "Couldn't save the image.");
    } finally {
      setBusy(false);
    }
  };

  const previewBg =
    image && previewRef.current
      ? buildPreviewBg(image, previewRef.current.getBoundingClientRect(), offset, zoom)
      : undefined;

  // Frame size: width fixed, height derived from frameAspect. Avatar
  // uses 320px wide; hero is harder to fit in a dialog so we cap at
  // 480 wide and let the natural aspect drive height (~162px tall).
  const frameWidth = kind === "avatar" ? 320 : 480;
  const frameHeight = Math.round(frameWidth / spec.frameAspect);

  return (
    <div
      role="dialog"
      aria-label={spec.title}
      className="fixed inset-0 z-40 grid place-items-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="card p-5 w-full max-w-lg space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="h2">{spec.title}</h2>
          <button className="btn-ghost text-xs" onClick={onClose} disabled={busy}>
            ✕ Close
          </button>
        </div>
        <p className="muted text-xs">{spec.hint}</p>

        {!image && (
          <label className="flex flex-col items-center gap-2 p-6 border-2 border-dashed border-white/15 rounded-xl cursor-pointer hover:border-accent/60 hover:bg-white/5 transition">
            <span className="text-3xl">📷</span>
            <span className="text-sm font-semibold text-white">{spec.chooseLabel}</span>
            <span className="text-[11px] text-white/50">JPEG, PNG, or WebP · up to 8 MB</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            />
          </label>
        )}

        {image && (
          <div className="space-y-3">
            <div
              ref={previewRef}
              role="img"
              aria-label="Drag to reposition"
              className="relative mx-auto rounded-xl overflow-hidden bg-black/40 select-none touch-none cursor-grab active:cursor-grabbing"
              style={{
                width: `${frameWidth}px`,
                height: `${frameHeight}px`,
                ...(previewBg ?? {}),
                borderRadius: kind === "avatar" ? "50%" : "12px",
              }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            />
            <div className="flex items-center gap-3 text-xs text-white/60">
              <span>Zoom</span>
              <input
                type="range"
                min="1"
                max="4"
                step="0.05"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="flex-1"
                aria-label="Zoom"
              />
              <span className="tabular-nums w-10 text-right">{zoom.toFixed(2)}×</span>
            </div>
            <div className="flex justify-end gap-2">
              <label className="btn-ghost text-sm cursor-pointer">
                Pick a different file
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                />
              </label>
              <button
                className="btn-primary text-sm"
                onClick={handleSave}
                disabled={busy}
              >
                {busy ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="text-xs text-bad bg-bad/10 border border-bad/30 rounded-lg p-2">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

// -- Render helpers ----------------------------------------------------

/**
 * Build the CSS `background-*` props to position the source image
 * inside the preview frame at the current zoom + offset. We render
 * the preview as a `<div>` with a CSS background rather than a real
 * `<img>` so the user can drag without dealing with browser image-
 * dragging defaults — and so the preview math matches the canvas
 * crop math exactly.
 */
function buildPreviewBg(
  image: HTMLImageElement,
  frame: { width: number; height: number },
  offset: { x: number; y: number },
  zoom: number,
): React.CSSProperties {
  // "cover"-fit at zoom=1: the smaller dimension fills the frame.
  const baseScale = Math.max(frame.width / image.naturalWidth, frame.height / image.naturalHeight);
  const scale = baseScale * zoom;
  const renderedW = image.naturalWidth * scale;
  const renderedH = image.naturalHeight * scale;
  const centerX = (frame.width - renderedW) / 2 + offset.x;
  const centerY = (frame.height - renderedH) / 2 + offset.y;
  return {
    backgroundImage: `url(${image.src})`,
    backgroundRepeat: "no-repeat",
    backgroundSize: `${renderedW}px ${renderedH}px`,
    backgroundPosition: `${centerX}px ${centerY}px`,
  };
}

/**
 * Crop the image to the preview frame at the user's current zoom +
 * offset, then resample to the target output size and encode JPEG.
 *
 * Math mirrors `buildPreviewBg`: same baseScale, same offset
 * arithmetic. The crop region in source-pixel coordinates is the
 * inverse of the preview transform.
 */
function renderCrop(args: {
  image: HTMLImageElement;
  previewRect: { width: number; height: number };
  offset: { x: number; y: number };
  zoom: number;
  spec: KindSpec;
}): string {
  const { image, previewRect, offset, zoom, spec } = args;
  const baseScale = Math.max(
    previewRect.width / image.naturalWidth,
    previewRect.height / image.naturalHeight,
  );
  const scale = baseScale * zoom;
  // Source-pixel rect that's currently visible in the preview frame.
  const srcW = previewRect.width / scale;
  const srcH = previewRect.height / scale;
  const renderedW = image.naturalWidth * scale;
  const renderedH = image.naturalHeight * scale;
  // Top-left of the preview frame in source-pixel coords.
  const previewLeftPx = (renderedW - previewRect.width) / 2 - offset.x;
  const previewTopPx = (renderedH - previewRect.height) / 2 - offset.y;
  const srcX = previewLeftPx / scale;
  const srcY = previewTopPx / scale;

  const out = document.createElement("canvas");
  out.width = spec.outputWidth;
  out.height = spec.outputHeight;
  const ctx = out.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D not available.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    image,
    Math.max(0, srcX),
    Math.max(0, srcY),
    Math.min(image.naturalWidth - Math.max(0, srcX), srcW),
    Math.min(image.naturalHeight - Math.max(0, srcY), srcH),
    0,
    0,
    spec.outputWidth,
    spec.outputHeight,
  );
  // q=0.85 is a good size/quality tradeoff for avatars + banners; a
  // 512×512 typically lands at 30-50 KB, well under our 1 MB cap.
  return out.toDataURL("image/jpeg", 0.85);
}
