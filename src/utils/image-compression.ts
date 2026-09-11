import { MAX_STORED_BYTES } from "@/lib/image-constants";

/**
 * Client-side image compression. Downscales and re-encodes raster images so
 * uploads arrive under the server's storage budget (500 KB) before they leave
 * the browser. Best-effort: falls back to the original file when compression
 * is unnecessary or unsupported (the server ladder enforces the budget).
 */

// Canvas decode/encode is reliable for these types; gif/avif are skipped and
// handled by the server-side compression ladder instead.
const COMPRESSIBLE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const DIMENSION_RUNGS = [1920, 1280, 1024, 800];
const QUALITY_LADDER = [0.85, 0.7, 0.55, 0.4, 0.3, 0.2];

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

function toWebpFilename(name: string): string {
  const stem = name.replace(/\.[^.]+$/, "");
  return `${stem || "image"}.webp`;
}

export async function compressImageToBudget(
  file: File,
  budgetBytes: number = MAX_STORED_BYTES,
): Promise<File> {
  if (file.size <= budgetBytes || !COMPRESSIBLE_TYPES.has(file.type)) {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    try {
      const base = Math.max(bitmap.width, bitmap.height);
      for (const rung of DIMENSION_RUNGS) {
        // Never upscale; scale = 1 keeps the original dimensions.
        const scale = Math.min(1, rung / base);
        const width = Math.max(1, Math.round(bitmap.width * scale));
        const height = Math.max(1, Math.round(bitmap.height * scale));

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return file;
        ctx.drawImage(bitmap, 0, 0, width, height);

        for (const quality of QUALITY_LADDER) {
          // WebP keeps alpha and compresses best. Browsers that cannot encode
          // it silently fall back to PNG in canvas.toBlob — a null result
          // means the encoder is unavailable, so abandon the canvas path.
          const blob = await canvasToBlob(canvas, "image/webp", quality);
          if (!blob) return file;
          if (blob.size <= budgetBytes) {
            return new File([blob], toWebpFilename(file.name), {
              type: "image/webp",
            });
          }
        }
      }
    } finally {
      bitmap.close();
    }
  } catch {
    // Best-effort: unsupported browsers/formats fall through to the original
    // file; the server-side ladder is the hard guarantee.
  }
  return file;
}
