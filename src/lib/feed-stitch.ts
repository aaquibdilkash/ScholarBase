/**
 * Pure stitching helpers for the Tri-Split feed.
 *
 * Kept free of Prisma / Next imports so the mapping (cached public row + live
 * viewer snapshot -> card-ready item) is unit-testable without a database.
 * See `src/lib/feed-cache.ts` for the data access and
 * `src/types/feed.ts` for the contracts.
 */
import type { VoteType } from "@prisma/client";

import type { MentionUser } from "@/components/interactions/CommentThread";
import type {
  CachedPublicSocialPost,
  PublicSocialPost,
  SocialPostFeedItem,
  SocialPostLiveCounters,
  SocialPostLiveOverlay,
} from "@/types/feed";

/** Rehydrates the ISO date strings produced by the cache serializer. */
export function rehydratePublicSocialPost(
  post: CachedPublicSocialPost,
): PublicSocialPost {
  return {
    ...post,
    createdAt: new Date(post.createdAt),
    updatedAt: new Date(post.updatedAt),
    editedAt: post.editedAt ? new Date(post.editedAt) : null,
  };
}

/** Normalises the Json column the same way `castPost` does in the feed actions. */
function toMentions(mentions: unknown): MentionUser[] | null {
  return Array.isArray(mentions) ? (mentions as unknown as MentionUser[]) : null;
}

/**
 * Overlays a page of cached posts with the live half of the split: the viewer's
 * vote / bookmark / follow state **and** the post's materialized counters.
 *
 * Pass `null` for anonymous visitors: they keep the cached counters and empty
 * `votes` / `bookmarks` / `followers` arrays, so every card renders the
 * signed-out state without a second code path.
 */
export function stitchSocialPostLiveState(
  posts: CachedPublicSocialPost[],
  overlay: SocialPostLiveOverlay | null,
): SocialPostFeedItem[] {
  // O(1) lookups so stitching stays linear in the page size, never quadratic.
  const voteByPostId = new Map<string, VoteType>();
  const bookmarkByPostId = new Map<string, string>();
  const countersByPostId = new Map<string, SocialPostLiveCounters>();

  for (const vote of overlay?.votes ?? []) {
    voteByPostId.set(vote.socialPostId, vote.voteType);
  }
  for (const bookmark of overlay?.bookmarks ?? []) {
    bookmarkByPostId.set(bookmark.socialPostId, bookmark.id);
  }
  for (const counters of overlay?.counters ?? []) {
    countersByPostId.set(counters.socialPostId, counters);
  }

  const followedAuthorIds = new Set(overlay?.following ?? []);
  const viewerId = overlay?.viewerId;

  return posts.map((cached) => {
    const post = rehydratePublicSocialPost(cached);
    const voteType = voteByPostId.get(post.id);
    const bookmarkId = bookmarkByPostId.get(post.id);
    const liveCounters = countersByPostId.get(post.id);
    const isFollowing = viewerId != null && followedAuthorIds.has(post.authorId);

    return {
      ...post,
      // Live counters win. The cached batch value stays the fallback for
      // anonymous visitors and for any post absent from the overlay.
      totalVotes: liveCounters?.totalVotes ?? post.totalVotes,
      totalBookmarks: liveCounters?.totalBookmarks ?? post.totalBookmarks,
      totalComments: liveCounters?.totalComments ?? post.totalComments,
      mentions: toMentions(post.mentions),
      votes: voteType ? [{ voteType }] : [],
      bookmarks: bookmarkId ? [{ id: bookmarkId }] : [],
      author: {
        ...post.author,
        followers:
          isFollowing && viewerId != null ? [{ followerId: viewerId }] : [],
      },
    };
  });
}
