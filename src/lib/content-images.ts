import "server-only";

import {
  extractContentImagePathsFromHtml,
  extractContentImageUrlsFromHtml,
  extractCoverImagePath,
  publishContentImage,
  type ContentImageKind,
} from "@/lib/supabase-storage";
import { repairLegacyInlineImages } from "@/lib/article-content";

/**
 * Returns the storage paths of the images that an edit REMOVED from a
 * content body — the garbage that has to be collected.
 *
 * Compares the image set of the stored body against the image set of the new
 * body. Only paths that were in the STORED body can come out of this, so the
 * result is always owned by the content being edited.
 *
 * Legacy rows stored their images as escaped text; both sides are repaired
 * first so a legacy image is recognised as removed rather than as a new one.
 */
export function findRemovedImagePaths(
  oldHtml: string,
  newHtml: string,
): string[] {
  const oldPaths = new Set(
    extractContentImagePathsFromHtml(repairLegacyInlineImages(oldHtml)),
  );
  const newPaths = new Set(
    extractContentImagePathsFromHtml(repairLegacyInlineImages(newHtml)),
  );

  const removed: string[] = [];
  for (const path of oldPaths) {
    if (!newPaths.has(path)) removed.push(path);
  }
  return removed;
}

export type PromoteContentImagesResult =
  | { ok: true; coverUrl: string | null; publishedHtml: string }
  | { ok: false; error: string };

/**
 * Message returned when draft images cannot be published. Deliberately
 * generic — the Storage error is infrastructure detail — but it is logged in
 * full so the cause reaches the server logs and Sentry.
 */
const PROMOTE_FAILED_MESSAGE =
  "Your images could not be saved. Please try again in a moment.";

/**
 * Promotes draft content images to published.
 *
 * Never throws: a Storage failure (misconfigured bucket policy, outage) is
 * returned as `{ ok: false }` so the calling action can answer with its normal
 * `{ success: false }` shape instead of a 500 with a hidden error digest.
 *
 * The failure happens BEFORE the row is written, so content is never saved
 * pointing at `drafts/` URLs that only its owner can read. The drafts stay in
 * place, so retrying the submit promotes them.
 */
export async function promoteContentImages(args: {
  /** Folder for the cover image. */
  coverKind: ContentImageKind;
  /**
   * Folder for inline body images. Omit for modules that do not support
   * them (the cover is then the only kind in play).
   */
  inlineKind?: ContentImageKind;
  imageUrl?: string | null;
  html: string;
  userId: string;
}): Promise<PromoteContentImagesResult> {
  try {
    const { coverUrl, publishedHtml } = await promoteContentImagesOrThrow(args);
    return { ok: true, coverUrl, publishedHtml };
  } catch (error) {
    console.error(
      "[promoteContentImages] Failed to publish content images:",
      error,
    );
    return { ok: false, error: PROMOTE_FAILED_MESSAGE };
  }
}

/**
 * The actual promotion. Throws on a Storage error; `promoteContentImages` is
 * the public, non-throwing entry point.
 *
 * NOT a server action: this takes the already-resolved owner's id, so it must
 * never be reachable as an action endpoint (a client could otherwise pass
 * someone else's id). It is called only from the create/update actions of the
 * content modules, which resolve the viewer server-side first.
 *
 * Draft objects are copied to the published folder and the drafts removed.
 */
async function promoteContentImagesOrThrow({
  coverKind,
  inlineKind,
  imageUrl,
  html,
  userId,
}: {
  coverKind: ContentImageKind;
  inlineKind?: ContentImageKind;
  imageUrl?: string | null;
  html: string;
  userId: string;
}): Promise<{
  coverUrl: string | null;
  publishedHtml: string;
}> {
  let coverUrl: string | null = null;

  if (imageUrl) {
    const coverPath = extractCoverImagePath(imageUrl);
    // Only DRAFT objects are promoted. A cover that is already published (the
    // common case when editing content without replacing the image) must be
    // kept as-is: re-copying it onto its own published path fails with
    // "The resource already exists".
    if (coverPath && coverPath.includes("/drafts/")) {
      // Only the owner's own draft may be promoted — the cover URL is client
      // supplied, so without this a crafted form could try to publish (and
      // then read back) somebody else's draft object. Row-level security
      // would reject the copy, but the invariant belongs in the code.
      if (!coverPath.startsWith(`users/${userId}/drafts/`)) {
        throw new Error("Cover image is not owned by the current user.");
      }
      coverUrl = await publishContentImage({
        userId,
        draftPath: coverPath,
        kind: coverKind,
      });
    } else {
      // Already a published URL, a non-Supabase URL, or an unparseable one —
      // keep it as-is.
      coverUrl = imageUrl;
    }
  }

  // Replace inline draft image urls in the HTML with their published urls.
  // The replacement uses the EXACT url string found in the HTML, so it does
  // not depend on the storage origin in the environment matching the one the
  // url was minted with.
  const inlineRefs = extractContentImageUrlsFromHtml(html);
  let publishedHtml = html;

  if (inlineKind) {
    for (const { url, path } of inlineRefs) {
      // Already published — nothing to promote.
      if (!path.includes("/drafts/")) continue;
      // Only the owner's own drafts may be promoted. The body is client
      // supplied, so a crafted body could otherwise try to publish (and then
      // read back) somebody else's draft object.
      if (!path.startsWith(`users/${userId}/drafts/`)) continue;

      const publishedUrl = await publishContentImage({
        userId,
        draftPath: path,
        kind: inlineKind,
      });
      publishedHtml = publishedHtml.split(url).join(publishedUrl);
    }
  }

  return { coverUrl, publishedHtml };
}
