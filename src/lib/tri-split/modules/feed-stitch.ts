/**
 * The feed's stitch rules, kept free of Prisma so the mapping is unit-testable
 * without a database (the factory's own wiring lives in `./feed-config`).
 */
import type {
  CachedPublicSocialPost,
  PublicSocialPost,
  SocialPostFeedItem,
} from "@/types/feed";
import type { MentionUser } from "@/components/interactions/CommentThread";
import type { StitchOptions } from "@/lib/tri-split";

/** Normalises the Json mentions column the same way `castPost` does. */
export function toMentions(mentions: unknown): MentionUser[] | null {
  return Array.isArray(mentions) ? (mentions as unknown as MentionUser[]) : null;
}

/** Revives the ISO date strings the cache serializer produced. */
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

/** Counter columns overlaid live for every viewer. */
export const FEED_COUNTER_KEYS = [
  "totalVotes",
  "totalBookmarks",
  "totalComments",
] as const;

/** The feed's folding rules for {@link stitchLiveState}. */
export const feedStitchOptions: StitchOptions<
  CachedPublicSocialPost,
  SocialPostFeedItem
> = {
  getRowId: (post) => post.id,
  getAuthorId: (post) => post.authorId,
  counterKeys: FEED_COUNTER_KEYS,
  // The generic stitch works in `Record<string, unknown>`; this is the one
  // place the concrete post shape is asserted back in.
  rehydrate: rehydratePublicSocialPost as unknown as (
    row: CachedPublicSocialPost,
  ) => Record<string, unknown>,
  normalize: (post) => ({ mentions: toMentions(post.mentions) }),
};
