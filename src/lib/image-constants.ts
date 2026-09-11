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