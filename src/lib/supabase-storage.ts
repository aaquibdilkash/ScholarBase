import "server-only";

import { createClient } from "@/utils/supabase/server";
import { createServiceClient } from "@/utils/supabase/service";

/**
 * Supabase Storage bucket used for content images (blog articles, call for
 * papers). Public bucket: URLs resolve directly without signed URLs.
 */
export const CONTENT_IMAGE_BUCKET = "content-images";

/**
 * The kind of image an object holds.
 *
 * It is the folder segment under the owner, so it is module-scoped: an
 * article's cover and a call for paper's cover are different folders and can
 * never be confused for one another.
 *
 * Modules whose editor does not offer inline uploads still declare an inline
 * kind, so a draft image that somehow reaches the body is promoted rather
 * than left pointing at a draft object that gets collected.
 */
export type ContentImageKind =
  | "article-cover"
  | "article-inline"
  | "cfp-cover"
  | "cfp-inline"
  | "position-cover"
  | "position-inline"
  | "admission-cover"
  | "admission-inline";

/**
 * Returns a server-side Supabase client for Storage operations.
 */
async function getSupabase() {
  return createClient();
}

/**
 * Uploads a blog image buffer to Supabase Storage under a user's draft folder.
 * Path: `users/{userId}/drafts/{kind}/{uuid}/{fileName}`
 *
 * @param userId - Owner of the image (used for folder isolation).
 * @param buffer - Image file bytes.
 * @param fileName - Original file name (extension preserved).
 * @param kind - "cover" or "inline" — determines subfolder.
 * @returns { url, path, bytes }
 */
export async function uploadBlogImage({
  userId,
  buffer,
  fileName,
  kind,
  fileType,
}: {
  userId: string;
  buffer: Buffer;
  fileName: string;
  kind: ContentImageKind;
  fileType: string;
}): Promise<{ url: string; path: string; bytes: number }> {
  const supabase = await getSupabase();
  const path = `users/${userId}/drafts/${kind}/${crypto.randomUUID()}/${fileName}`;

  const { error } = await supabase.storage
    .from(CONTENT_IMAGE_BUCKET)
    .upload(path, buffer, {
      cacheControl: "3600",
      upsert: false,
      contentType: fileType,
    });

  if (error) {
    throw new Error(`Failed to upload image to Supabase Storage: ${error.message}`);
  }

  const { data: urlData } = supabase.storage.from(CONTENT_IMAGE_BUCKET).getPublicUrl(path);

  return {
    url: urlData.publicUrl,
    path,
    bytes: buffer.length,
  };
}

/**
 * Copies a draft image to the published folder and removes the draft object.
 * Called when an article is published: draft -> published.
 *
 * Path: `users/{userId}/published/{kind}/{uuid}/{fileName}`
 *
 * The uuid segment is PRESERVED. Dropping it would map every upload called
 * `photo.png` onto the same published path, so a second upload would collide
 * with the first ("The resource already exists") and silently overwrite it.
 *
 * @param userId - Owner of the image.
 * @param draftPath - Full storage path of the draft object.
 * @param kind - "cover" or "inline".
 * @returns The public URL of the published object.
 */
export async function publishBlogImage({
  userId,
  draftPath,
  kind,
}: {
  userId: string;
  draftPath: string;
  kind: ContentImageKind;
}): Promise<string> {
  const supabase = await getSupabase();

  const fileName = draftPath.split("/").pop()!;
  // The draft path is `users/{userId}/drafts/{kind}/{uuid}/{fileName}`; the
  // published path swaps `drafts` for `published` and keeps the uuid.
  const segments = draftPath.split("/");
  const uuid = segments.length >= 2 ? segments[segments.length - 2] : fileName;
  const publishedPath = `users/${userId}/published/${kind}/${uuid}/${fileName}`;

  const { error: copyError } = await supabase.storage
    .from(CONTENT_IMAGE_BUCKET)
    .copy(draftPath, publishedPath);

  if (copyError) {
    throw new Error(`Failed to publish image: ${copyError.message}`);
  }

  // Remove the draft copy
  await supabase.storage.from(CONTENT_IMAGE_BUCKET).remove([draftPath]);

  const { data: urlData } = supabase.storage.from(CONTENT_IMAGE_BUCKET).getPublicUrl(publishedPath);

  return urlData.publicUrl;
}

/**
 * Deletes one or more images from Supabase Storage by path.
 * Used by the orphaned-asset cleanup job.
 *
 * @param paths - Full storage paths to delete.
 */
export async function deleteBlogImagePaths(paths: string[]): Promise<void> {
  if (paths.length === 0) return;

  const supabase = await getSupabase();
  const { error } = await supabase.storage.from(CONTENT_IMAGE_BUCKET).remove(paths);

  if (error) {
    console.error("[deleteBlogImagePaths] Supabase Storage remove error:", error.message);
    // Don't throw — cleanup should be idempotent and non-blocking.
  }
}

/**
 * Deletes images using the SERVICE ROLE, which bypasses row-level security.
 *
 * Needed by the orphaned-asset cleanup cron: it deletes published objects
 * belonging to users who are not signed in, so no user session can authorise
 * those deletes. The paths always come from the `OrphanedAsset` queue, which
 * the trim cron populates from the content's own stored rows.
 */
export async function deleteBlogImagePathsAsServiceRole(
  paths: string[],
): Promise<void> {
  if (paths.length === 0) return;

  const supabase = createServiceClient();
  const { error } = await supabase.storage.from(CONTENT_IMAGE_BUCKET).remove(paths);

  if (error) {
    console.error(
      "[deleteBlogImagePathsAsServiceRole] Supabase Storage remove error:",
      error.message,
    );
  }
}

/**
 * Converts a public URL pathname into the Storage OBJECT KEY.
 *
 * `getPublicUrl` runs the path through `encodeURI`, so an object stored as
 * `download (2).jpeg` is addressed as `download%20(2).jpeg`. Storage `copy`
 * and `remove` take keys, not URLs: handing them the encoded string makes
 * them look for a key that does not exist ("Object not found"), which is why
 * every image whose file name held a space, a bracket or a non-ASCII
 * character failed to publish while `photo.png` worked.
 *
 * @param pathname - A public URL pathname (`/storage/v1/object/public/...`).
 * @returns The decoded storage key, or null when the bucket is not ours.
 */
function storageKeyFromPathname(pathname: string): string | null {
  const prefix = `/public/content-images/`;
  const idx = pathname.indexOf(prefix);
  if (idx === -1) return null;

  const encoded = pathname.slice(idx + prefix.length);
  try {
    return decodeURIComponent(encoded);
  } catch {
    // A malformed escape (the URL can be client supplied) is not a key we can
    // resolve. Keep it as-is rather than throwing; callers validate ownership.
    return encoded;
  }
}

/**
 * Extracts Supabase Storage image references from an HTML string.
 * Finds every  src attribute pointing at the content-images bucket.
 *
 * Returns the full `src` URL AND the DECODED storage key, so callers can
 * rewrite the exact URL string that appears in the HTML (instead of
 * reconstructing it from an env var, which breaks when the origin differs)
 * and hand the key to Storage `copy`/`remove` unchanged.
 *
 * @param html - HTML content (e.g., article.description).
 * @returns Array of { url, path }.
 */
export function extractBlogImageUrlsFromHtml(
  html: string,
): { url: string; path: string }[] {
  const refs: { url: string; path: string }[] = [];

  // Match Supabase Storage public URLs:
  // https://<project>.supabase.co/storage/v1/object/public/content-images/<path>
  const regex = /<img[^>]+src="([^"]*storage\/v1\/object\/public\/content-images\/[^"]+)"[^>]*>/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(html)) !== null) {
    const url = match[1];
    try {
      const parsed = new URL(url);
      const path = storageKeyFromPathname(parsed.pathname);
      if (path) {
        // `url` stays exactly as it appears in the HTML so the caller can
        // replace that string verbatim; `path` is the decoded storage key.
        refs.push({ url, path });
      }
    } catch {
      // Ignore unparseable URLs
    }
  }

  return refs;
}

/**
 * Extracts Supabase Storage paths from an HTML string.
 * Finds all  src attributes pointing to the content-images bucket.
 *
 * @param html - HTML content (e.g., article.description).
 * @returns Array of storage paths.
 */
export function extractBlogImagePathsFromHtml(html: string): string[] {
  return extractBlogImageUrlsFromHtml(html).map((ref) => ref.path);
}

/**
 * Extracts the Supabase Storage key from a public image URL.
 *
 * Works for any object in the `content-images` bucket (a cover or an inline
 * image), and returns the DECODED key so it can be handed to Storage
 * `copy`/`remove` unchanged — see `storageKeyFromPathname`.
 *
 * @param imageUrl - The stored image URL (Article.imageUrl and friends).
 * @returns Storage key or null when the URL is not a content-images object.
 */
export function extractCoverImagePath(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null;

  try {
    return storageKeyFromPathname(new URL(imageUrl).pathname);
  } catch {
    // Ignore
  }

  return null;
}
