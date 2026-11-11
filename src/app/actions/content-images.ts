"use server";

import {
  deleteBlogImagePaths,
  extractCoverImagePath,
  uploadBlogImage,
  type ContentImageKind,
} from "@/lib/supabase-storage";
import { getActiveUser, requireCurrentUser } from "@/lib/auth";
import {
  MAX_FILE_BYTES,
  MAX_STORED_BYTES,
  ALLOWED_IMAGE_TYPES,
} from "@/lib/image-constants";

export type ContentUploadKind = ContentImageKind;

export type ContentUploadResult = {
  url: string;
  path: string;
  bytes: number;
  width: number;
  height: number;
  format: string;
};

export type FrozenActionResult = { success: false; error: string; message: string };

/**
 * Uploads a content image to Supabase Storage.
 *
 * The client is expected to compress the file before upload (using
 * `compressImageToBudget` from `@/utils/image-compression`) so the stored
 * asset lands under the 500 KB budget. The server validates size/type and
 * rejects anything over the 5 MB raw ceiling.
 *
 * Draft uploads go to `users/{userId}/drafts/{kind}/{uuid}/{fileName}`.
 * On publish, `promoteContentImages` copies drafts to `published/`.
 *
 * @param formData - Must contain a `file` Field.
 * @param kind - Module-scoped folder the image belongs to.
 * @param options - { allowFrozen } to permit frozen accounts.
 */
export async function uploadContentImageAction(
  formData: FormData,
  kind: ContentUploadKind,
  options?: { allowFrozen?: boolean },
): Promise<ContentUploadResult | FrozenActionResult> {
  const auth = await getActiveUser("Log in to upload images.");
  if (auth.frozen && !options?.allowFrozen) {
    return { success: false, error: auth.message, message: auth.message };
  }
  const user = auth.frozen
    ? await requireCurrentUser("Log in to upload images.")
    : auth.user;

  try {
    const file = formData.get("file");
    if (!(file instanceof File)) throw new Error("No file provided");
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      throw new Error("Unsupported image type");
    }
    if (file.size > MAX_FILE_BYTES) {
      throw new Error("Image must be under 5 MB");
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Enforce the stored-byte budget on the server as a hard guarantee.
    if (buffer.length > MAX_STORED_BYTES) {
      throw new Error(
        `This image is too large to store under ${Math.round(MAX_STORED_BYTES / 1024)} KB. Please compress it before uploading.`,
      );
    }

    const result = await uploadBlogImage({
      userId: user.id,
      buffer,
      fileName: file.name,
      kind,
      fileType: file.type,
    });

    return {
      url: result.url,
      path: result.path,
      bytes: result.bytes,
      width: 0, // Client-side compression; dimensions not tracked server-side
      height: 0,
      format: file.type.split("/")[1] ?? "unknown",
    };
  } catch (error) {
    console.error("[UploadContentImageAction Error]:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Image upload failed.",
      message: error instanceof Error ? error.message : "Image upload failed.",
    };
  }
}

/**
 * Deletes draft images that belong to the current user.
 * Validates that each path starts with the user's own draft folder.
 */
export async function deleteDraftContentImage(
  imageUrl: string | null | undefined,
  options?: { allowFrozen?: boolean },
): Promise<boolean | FrozenActionResult> {
  if (!imageUrl) return true;

  const auth = await getActiveUser("Log in to delete draft images.");
  if (auth.frozen && !options?.allowFrozen) {
    return { success: false, error: auth.message, message: auth.message };
  }
  const user = auth.frozen
    ? await requireCurrentUser("Log in to delete draft images.")
    : auth.user;

  const path = extractCoverImagePath(imageUrl);
  if (!path) return false;

  const expectedPrefix = `users/${user.id}/`;
  if (!path.startsWith(`${expectedPrefix}drafts/`)) {
    console.warn("[deleteDraftContentImage] Rejected path outside user's draft folders:", {
      path,
      expectedPrefix,
    });
    return false;
  }

  await deleteBlogImagePaths([path]);
  return true;
}
