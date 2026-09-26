/**
 * Feed wiring for the shared Tri-Split list factory.
 *
 * This is the reference implementation: every other module's config mirrors
 * this shape. The factory owns the identity contract (the viewer is resolved
 * from the session, never from a caller argument), the cache policy, and the
 * single-statement live overlay — this file only declares what is specific to
 * the social-post module: its tables, its counter columns, and its filters.
 */
import { Prisma } from "@prisma/client";

import prisma from "@/lib/db";
import { createTriSplitList } from "@/lib/tri-split";
import { POST_METADATA_SELECT, PUBLIC_SOCIAL_POST_SELECT } from "@/types/feed";
import type { CachedPublicSocialPost, SocialPostFeedItem } from "@/types/feed";

import { FEED_COUNTER_KEYS, feedStitchOptions } from "./feed-stitch";

/** Cache tag for the viewer-agnostic public feed pages. */
export const FEED_PUBLIC_TAG = "feed-public";

const feedList = createTriSplitList<CachedPublicSocialPost, SocialPostFeedItem>({
  tag: FEED_PUBLIC_TAG,
  model: "socialPost",
  // RULE 4: soft-deleted posts never reach the feed.
  where: { isDeleted: false },
  select: PUBLIC_SOCIAL_POST_SELECT as unknown as Record<string, unknown>,
  orderBy: { createdAt: "desc" },
  // `unstable_cache` serialises via JSON.stringify, so dates become ISO
  // strings; the stitch's `rehydrate` revives them.
  dateKeys: ["createdAt", "updatedAt", "editedAt"],
  overlay: {
    row: "SocialPost",
    vote: "SocialVote",
    bookmark: "SocialPostBookmark",
    rowFk: "socialPostId",
    authorFk: "authorId",
    counterKeys: FEED_COUNTER_KEYS,
  },
  stitch: feedStitchOptions,
  // Search text and the viewer-scoped "following" tab make the result
  // non-shareable, so the factory routes those through the uncached path.
  buildWhere: (args) => {
    const query = typeof args.query === "string" ? args.query.trim() : "";
    const followingOnly = args.tab === "following";

    if (followingOnly) {
      // RULE 2/RULE 5: a relation filter served by the
      // `Follows(followerId, followingId)` primary key replaces loading every
      // followed id into memory and posting it back as an unbounded IN (...).
      return {
        author: { followers: { some: { followerId: args.viewerId as string } } },
      };
    }

    if (!query) return {};

    const mode = Prisma.QueryMode.insensitive;
    return {
      OR: [
        { content: { contains: query, mode } },
        { author: { name: { contains: query, mode } } },
        { author: { handle: { contains: query, mode } } },
      ],
    };
  },
});

/** Loads one page of the feed for the current viewer. */
export function loadFeedPage(args: {
  tab?: string;
  query?: string;
  pageSize?: number;
  cursor?: string;
  viewerId?: string | null;
}): Promise<SocialPostFeedItem[]> {
  return feedList.fetchPage(args);
}

/**
 * Purges every cached public feed page.
 *
 * Uses `expire: 0` rather than a stale-while-revalidate purge, which would keep
 * serving a deleted or frozen post — not acceptable for author deletions or
 * moderation. The single-argument `revalidateTag(tag)` form is deprecated in
 * Next 16.
 */
export function revalidatePublicFeed(): void {
  feedList.revalidate();
}

/**
 * Slim metadata row for the detail page's `generateMetadata`.
 *
 * Kept separate from the body query because `generateMetadata` and the page
 * call `getPost` with *different* argument tuples, so React's request-level
 * `cache()` cannot dedupe them and the full post query (comments, votes,
 * bookmarks, followers) ran twice per detail page request. Metadata needs none
 * of that.
 */
export async function getPostMetadata(id: string) {
  return prisma.socialPost.findUnique({
    where: { id, isDeleted: false },
    select: POST_METADATA_SELECT,
  });
}
