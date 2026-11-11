import "server-only";

import {
  extractBlogImageUrlsFromHtml,
  extractCoverImagePath,
  publishBlogImage,
} from "@/lib/supabase-storage";

/**
 * Promotes draft blog images to published.
 *
 * NOT a server action: this takes the already-resolved owner's id, so it must
 * never be reachable as an action endpoint (a client could otherwise pass
 * someone else's id). It is called only from the article create/update actions
 * in `@/app/actions/blog`, which resolve the viewer server-side first.
 *
 * Draft objects are copied to the published folder and the drafts removed.
 *
 * @param imageUrl - Optional cover image URL (draft) to promote.
 * @param html - Article content HTML containing inline image draft URLs.
 * @param userId - Owner of the images.
 * @returns { coverUrl, publishedHtml } with draft paths replaced by published paths.
 */
export async function promoteBlogImages({
  imageUrl,
  html,
  userId,
}: {
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
    // common case when editing an article without replacing the image) must be
    // kept as-is: re-copying it onto its own published path fails with
    // "The resource already exists".
    if (coverPath && coverPath.includes("/drafts/")) {
      coverUrl = await publishBlogImage({
        userId,
        draftPath: coverPath,
        kind: "cover",
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
  const inlineRefs = extractBlogImageUrlsFromHtml(html);
  let publishedHtml = html;

  for (const { url, path } of inlineRefs) {
    // Already published — nothing to promote.
    if (!path.includes("/drafts/")) continue;

    const publishedUrl = await publishBlogImage({
      userId,
      draftPath: path,
      kind: "inline",
    });
    publishedHtml = publishedHtml.split(url).join(publishedUrl);
  }

  return { coverUrl, publishedHtml };
}
