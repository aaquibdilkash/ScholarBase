export const POST_MAX_WIDTH = 1920;
export const POST_MAX_HEIGHT = 1920;
export const POST_QUALITY = "auto:good";

export const AVATAR_MAX_WIDTH = 800;
export const AVATAR_MAX_HEIGHT = 800;
export const AVATAR_QUALITY = "auto:good";

/** Raw upload ceiling — files larger than this are rejected before compression. */
export const MAX_FILE_BYTES = 5 * 1024 * 1024;

/**
 * Byte budget for the STORED asset. Uploads are progressively compressed
 * (quality/dimension ladder) until they fit under this size; images that
 * cannot be compressed under the budget are rejected.
 */
export const MAX_STORED_BYTES = 500 * 1024;

export const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);

/**
 * Display height cap (px) for a content cover. The expanded list card and every
 * detail page share it so a cover reads identically in both places. The cover
 * is contained (aspect ratio preserved) and the box shrinks to the image when
 * the image is shorter than the cap.
 */
export const CONTENT_IMAGE_MAX_HEIGHT = 300;

/**
 * Fraction of a content cover that stays visible in a collapsed list card. The
 * rest is hidden below and revealed by "View more".
 */
export const CONTENT_IMAGE_COLLAPSED_RATIO = 0.25;

/**
 * Type guard: true when `url` is a non-empty string that parses as an absolute
 * http(s) URL. Feed components use it to filter out local paths like
 * "image.png" before rendering <Image>/lightbox assets.
 */
export function isValidImageUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}