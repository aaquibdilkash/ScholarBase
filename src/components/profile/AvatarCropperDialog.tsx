"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

type AvatarCropperDialogProps = {
  file: File;
  onClose: () => void;
  /** Receives the cropped square image. Throws with a user-facing message on failure. */
  onConfirm: (file: File) => Promise<void>;
};

// Internal (coordinate-system) size of the square crop viewport. Display size
// scales responsively; all pointer math is normalized back into this space.
const VIEW_SIZE = 320;
// Edge length of the exported square, matching the server's avatar cap.
const OUTPUT_SIZE = 1024;
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const WHEEL_SENSITIVITY = 0.0015;

// The image is always drawn to fully cover the viewport (zoom >= 1 over the
// CSS cover scale), so the allowed pan range keeps every pixel of the square
// filled — the same invariant the final export preserves.
type Transform = {
  zoom: number;
  offsetX: number; // drawn image top-left within the viewport
  offsetY: number;
};

function coverScale(img: { width: number; height: number }): number {
  return Math.max(VIEW_SIZE / img.width, VIEW_SIZE / img.height);
}

function clampTransform(
  img: { width: number; height: number },
  t: Transform,
): Transform {
  const dw = img.width * coverScale(img) * t.zoom;
  const dh = img.height * coverScale(img) * t.zoom;
  return {
    zoom: t.zoom,
    offsetX: Math.min(0, Math.max(VIEW_SIZE - dw, t.offsetX)),
    offsetY: Math.min(0, Math.max(VIEW_SIZE - dh, t.offsetY)),
  };
}

/** Scale change that keeps the image point under (cx, cy) pinned in place. */
function zoomAt(
  img: { width: number; height: number },
  t: Transform,
  nextZoom: number,
  cx: number,
  cy: number,
): Transform {
  const base = coverScale(img);
  const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom));
  const dw1 = img.width * base * t.zoom;
  const imageX = (cx - t.offsetX) / dw1;
  const imageY = (cy - t.offsetY) / dw1;
  const dw2 = img.width * base * z;
  const dh2 = img.height * base * z;
  return clampTransform(img, {
    zoom: z,
    offsetX: cx - imageX * dw2,
    offsetY: cy - imageY * dh2,
  });
}

const EXPORT_FORMATS: Array<[string, number | undefined]> = [
  ["image/webp", 0.92],
  ["image/jpeg", 0.92],
  ["image/png", undefined],
];

export default function AvatarCropperDialog({
  file,
  onClose,
  onConfirm,
}: AvatarCropperDialogProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const transformRef = useRef<Transform>({ zoom: 1, offsetX: 0, offsetY: 0 });
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchDistRef = useRef<number | null>(null);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [zoomDisplay, setZoomDisplay] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !img || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== VIEW_SIZE * dpr) {
      canvas.width = VIEW_SIZE * dpr;
      canvas.height = VIEW_SIZE * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, VIEW_SIZE, VIEW_SIZE);
    const t = transformRef.current;
    const base = coverScale(img);
    ctx.drawImage(
      img,
      t.offsetX,
      t.offsetY,
      img.width * base * t.zoom,
      img.height * base * t.zoom,
    );
  }, []);

  // Load and decode the selected file.
  useEffect(() => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.src = url;
    let cancelled = false;
    img
      .decode()
      .then(() => {
        if (cancelled) return;
        imageRef.current = img;
        // Start centered at minimum zoom.
        const dw = img.width * coverScale(img);
        const dh = img.height * coverScale(img);
        transformRef.current = {
          zoom: 1,
          offsetX: (VIEW_SIZE - dw) / 2,
          offsetY: (VIEW_SIZE - dh) / 2,
        };
        setZoomDisplay(1);
        setReady(true);
        draw();
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError("Could not read this image. Please try another file.");
        }
      });
    return () => {
      cancelled = true;
      URL.revokeObjectURL(url);
    };
  }, [file, draw]);

  // Normalize a client point into viewport coordinates (handles the
  // responsively scaled canvas).
  const toViewPoint = useCallback(
    (clientX: number, clientY: number) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      const k = rect && rect.width > 0 ? VIEW_SIZE / rect.width : 1;
      return {
        x: (clientX - (rect?.left ?? 0)) * k,
        y: (clientY - (rect?.top ?? 0)) * k,
      };
    },
    [],
  );

  const applyZoom = useCallback(
    (nextZoom: number, cx: number, cy: number) => {
      const img = imageRef.current;
      if (!img) return;
      const t = zoomAt(img, transformRef.current, nextZoom, cx, cy);
      transformRef.current = t;
      setZoomDisplay(t.zoom);
      draw();
    },
    [draw],
  );

  // Wheel zoom needs a non-passive native listener (React attaches wheel
  // listeners passively, so preventDefault would be ignored there).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handler = (e: WheelEvent) => {
      if (!imageRef.current) return;
      e.preventDefault();
      const p = toViewPoint(e.clientX, e.clientY);
      applyZoom(
        transformRef.current.zoom * Math.exp(-e.deltaY * WHEEL_SENSITIVITY),
        p.x,
        p.y,
      );
    };
    canvas.addEventListener("wheel", handler, { passive: false });
    return () => canvas.removeEventListener("wheel", handler);
  }, [applyZoom, toViewPoint]);

  // Close on Escape (unless a crop/upload is in flight).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, busy]);



  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!ready) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size === 2) {
      const [a, b] = [...pointersRef.current.values()];
      if (a && b) pinchDistRef.current = Math.hypot(a.x - b.x, a.y - b.y);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const img = imageRef.current;
    if (!img || !pointersRef.current.has(e.pointerId)) return;
    const prev = pointersRef.current.get(e.pointerId)!;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size === 1) {
      // Scale the drag delta into viewport coordinates for the scaled canvas.
      const k =
        VIEW_SIZE /
        (e.currentTarget.getBoundingClientRect().width || VIEW_SIZE);
      const t = transformRef.current;
      transformRef.current = clampTransform(img, {
        zoom: t.zoom,
        offsetX: t.offsetX + (e.clientX - prev.x) * k,
        offsetY: t.offsetY + (e.clientY - prev.y) * k,
      });
      draw();
    } else if (pointersRef.current.size === 2) {
      const [a, b] = [...pointersRef.current.values()];
      if (!a || !b) return;
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const prevDist = pinchDistRef.current;
      if (prevDist && dist > 0) {
        const mid = toViewPoint((a.x + b.x) / 2, (a.y + b.y) / 2);
        applyZoom(transformRef.current.zoom * (dist / prevDist), mid.x, mid.y);
      }
      pinchDistRef.current = dist;
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchDistRef.current = null;
  };

  // Export exactly what the viewport shows, scaled to the output square.
  async function exportCroppedFile(): Promise<File> {
    const img = imageRef.current;
    if (!img) throw new Error("Image is still loading. Please try again.");
    const t = transformRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error(
        "This browser can't process images. Please try another browser.",
      );
    }
    const base = coverScale(img);
    const s = OUTPUT_SIZE / VIEW_SIZE;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(
      img,
      t.offsetX * s,
      t.offsetY * s,
      img.width * base * t.zoom * s,
      img.height * base * t.zoom * s,
    );
    for (const [mime, quality] of EXPORT_FORMATS) {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, mime, quality),
      );
      if (blob) {
        const ext =
          mime === "image/webp" ? "webp" : mime === "image/jpeg" ? "jpg" : "png";
        const stem = file.name.replace(/\.[^.]+$/, "") || "avatar";
        return new File([blob], `${stem}.${ext}`, { type: mime });
      }
    }
    throw new Error(
      "This browser can't process images. Please try another browser.",
    );
  }

  async function handleConfirm() {
    if (busy || !ready) return;
    setBusy(true);
    setError("");
    try {
      const cropped = await exportCroppedFile();
      await onConfirm(cropped);
      onClose();
    } catch (err) {
      // Keep the dialog open so the user can retry or cancel; the message
      // mirrors the parent's uploadError, which is set by onConfirm.
      setError(err instanceof Error ? err.message : "Failed to crop image.");
    } finally {
      setBusy(false);
    }
  }


  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div
        className="flex min-h-full items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
        onClick={(e) => {
          if (e.target === e.currentTarget && !busy) onClose();
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Crop avatar"
          className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900"
        >
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Crop your avatar
            </h3>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
            >
              <span className="sr-only">Close</span>×
            </button>
          </div>

          <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
            Drag to reposition. Scroll, pinch, or use the slider to zoom.
          </p>

          <div className="relative mx-auto aspect-square w-full max-w-[320px]">
            <canvas
              ref={canvasRef}
              style={{ width: "100%", height: "100%", touchAction: "none" }}
              className={`rounded-full border-2 border-slate-200 select-none dark:border-slate-700 touch-none ${
                ready && !busy ? "cursor-grab active:cursor-grabbing" : ""
              }`}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            />
            {(!ready || busy) && !loadError && (
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-slate-900/40">
                <Loader2 className="h-6 w-6 animate-spin text-white" />
              </div>
            )}
          </div>
          {loadError && (
            <p className="mt-2 text-center text-xs font-medium text-red-500">
              {loadError}
            </p>
          )}
          {error && (
            <p className="mt-2 text-center text-xs font-medium text-red-500">
              {error}
            </p>
          )}

          <div className="mt-4 flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              Zoom
            </span>
            <input
              type="range"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={0.01}
              value={zoomDisplay}
              aria-label="Zoom"
              disabled={!ready || busy || !!loadError}
              onChange={(e) =>
                applyZoom(Number(e.target.value), VIEW_SIZE / 2, VIEW_SIZE / 2)
              }
              className="w-full accent-blue-600"
            />
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={busy || !ready || !!loadError}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Crop &amp; Upload
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
