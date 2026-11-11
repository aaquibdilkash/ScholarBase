import "server-only";

import { createClient } from "@/utils/supabase/server";

/**
 * Supabase Storage bucket used for blog (Article) images.
 * Public bucket: URLs resolve directly without signed URLs.
 */
export const BLOG_IMAGE_BUCKET = "blog-images";

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
  kind: "cover" | "inline";
  fileType: string;
}): Promise<{ url: string; path: string; bytes: number }> {
  const supabase = await getSupabase();
  const path = `users/${userId}/drafts/${kind}/${crypto.randomUUID()}/${fileName}`;

  const { error } = await supabase.storage
    .from(BLOG_IMAGE_BUCKET)
    .upload(path, buffer, {
      cacheControl: "3600",
      upsert: false,
      contentType: fileType,
    });

  if (error) {
    throw new Error(`Failed to upload image to Supabase Storage: ${error.message}`);
  }

  const { data: urlData } = supabase.storage.from(BLOG_IMAGE_BUCKET).getPublicUrl(path);

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
 * Path: `users/{userId}/published/{kind}/{fileName}`
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
  kind: "cover" | "inline";
}): Promise<string> {
  const supabase = await getSupabase();

  const fileName = draftPath.split("/").pop()!;
  const publishedPath = `users/${userId}/published/${kind}/${fileName}`;

  const { error: copyError } = await supabase.storage
    .from(BLOG_IMAGE_BUCKET)
    .copy(draftPath, publishedPath);

  if (copyError) {
    throw new Error(`Failed to publish image: ${copyError.message}`);
  }

  // Remove the draft copy
  await supabase.storage.from(BLOG_IMAGE_BUCKET).remove([draftPath]);

  const { data: urlData } = supabase.storage.from(BLOG_IMAGE_BUCKET).getPublicUrl(publishedPath);

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
  const { error } = await supabase.storage.from(BLOG_IMAGE_BUCKET).remove(paths);

  if (error) {
    console.error("[deleteBlogImagePaths] Supabase Storage remove error:", error.message);
    // Don't throw — cleanup should be idempotent and non-blocking.
  }
}

/**
 * Extracts Supabase Storage image references from an HTML string.
 * Finds every  src attribute pointing at the blog-images bucket.
 *
 * Returns the full `src` URL AND the storage path, so callers can rewrite
 * the exact URL string that appears in the HTML instead of reconstructing it
 * from an env var (which breaks when the origin differs).
 *
 * @param html - HTML content (e.g., article.description).
 * @returns Array of { url, path }.
 */
export function extractBlogImageUrlsFromHtml(
  html: string,
): { url: string; path: string }[] {
  const refs: { url: string; path: string }[] = [];

  // Match Supabase Storage public URLs:
  // https://<project>.supabase.co/storage/v1/object/public/blog-images/<path>
  const regex = /<img[^>]+src="([^"]*storage\/v1\/object\/public\/blog-images\/[^"]+)"[^>]*>/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(html)) !== null) {
    const url = match[1];
    try {
      const parsed = new URL(url);
      const prefix = `/public/blog-images/`;
      const idx = parsed.pathname.indexOf(prefix);
      if (idx !== -1) {
        refs.push({
          url,
          path: parsed.pathname.slice(idx + prefix.length),
        });
      }
    } catch {
      // Ignore unparseable URLs
    }
  }

  return refs;
}

/**
 * Extracts Supabase Storage paths from an HTML string.
 * Finds all  src attributes pointing to the blog-images bucket.
 *
 * @param html - HTML content (e.g., article.description).
 * @returns Array of storage paths.
 */
export function extractBlogImagePathsFromHtml(html: string): string[] {
  return extractBlogImageUrlsFromHtml(html).map((ref) => ref.path);
}

/**
 * Extracts the cover image storage path from an imageUrl field.
 *
 * @param imageUrl - The Article.imageUrl value.
 * @returns Storage path or null.
 */
export function extractCoverImagePath(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null;

  try {
    const parsed = new URL(imageUrl);
    const prefix = `/public/blog-images/`;
    const idx = parsed.pathname.indexOf(prefix);
    if (idx !== -1) {
      return parsed.pathname.slice(idx + prefix.length);
    }
  } catch {
    // Ignore
  }

  return null;
}
