/**
 * Feed data contracts (Tri-Split architecture).
 *
 * The feed is split into two independently-fetchable halves:
 *
 *  1. `PublicSocialPost` — viewer-agnostic, low-churn content (body, media,
 *     author, frozen/appeal flags). Safe to cache globally and share across
 *     every visitor (RULE 2: no dynamic `_count`, no per-user filtered selects).
 *  2. `SocialPostLiveOverlay` — everything volatile: "did *I* vote / bookmark /
 *     follow?" plus the live `totalVotes` / `totalBookmarks` / `totalComments`
 *     for the posts on the page. Always resolved live, per viewer, never cached.
 *
 * `SocialPostFeedItem` is the stitched result handed to `SocialPostCard`. It is
 * structurally assignable to the card's `SocialPostWithAuthor` contract, and
 * that assignability is enforced at the `FeedList` -> `SocialPostCard` call
 * site (a missing field is a compile error, never a silent `as unknown as`).
 */
import type { Prisma, VoteType } from "@prisma/client";
import type { MentionUser } from "@/components/interactions/CommentThread";

/**
 * Single source of truth for the viewer-agnostic half.
 *
 * Every field `SocialPostCard` reads without a viewer (`authorId`, `mentions`,
 * `isFrozen`, `hasActiveAppeal`) is present here on purpose — omitting one
 * silently disables owner actions, the moderation banner or mention links.
 * `votes` / `bookmarks` / `author.followers` are deliberately absent: they are
 * viewer state and belong to `SocialPostLiveOverlay`. The counters are included
 * only as the cached fallback for signed-out viewers — signed-in viewers get
 * live values from the overlay, which overrides these.
 */
export const PUBLIC_SOCIAL_POST_SELECT = {
  id: true,
  content: true,
  imageUrl: true,
  createdAt: true,
  updatedAt: true,
  editedAt: true,
  authorId: true,
  mentions: true,
  isFrozen: true,
  hasActiveAppeal: true,
  // RULE 2: materialized counters, never dynamic relation counts.
  totalVotes: true,
  totalBookmarks: true,
  totalComments: true,
  author: {
    select: {
      id: true,
      name: true,
      handle: true,
      avatarUrl: true,
      institutionVerifiedAt: true,
    },
  },
} as const satisfies Prisma.SocialPostSelect;

/** Viewer-agnostic post row, exactly as Prisma returns it. */
export type PublicSocialPost = Prisma.SocialPostGetPayload<{
  select: typeof PUBLIC_SOCIAL_POST_SELECT;
}>;

/**
 * Cache-safe variant of {@link PublicSocialPost}.
 *
 * `unstable_cache` stores results with `JSON.stringify`, so `Date` fields come
 * back as ISO strings. Modelling that explicitly (instead of asserting dates)
 * keeps the rehydration in `feed-stitch.ts` honest and testable.
 */
export type CachedPublicSocialPost = Omit<
  PublicSocialPost,
  "createdAt" | "updatedAt" | "editedAt"
> & {
  createdAt: string;
  updatedAt: string;
  editedAt: string | null;
};

/**
 * The materialized counters for one post, resolved live.
 *
 * These are the fields that change on every vote / bookmark / comment — which
 * is exactly why they belong to the live half of the split instead of the
 * cached content batch: a signed-in viewer sees the true number on the very
 * first paint, with no staleness window.
 */
export type SocialPostLiveCounters = {
  socialPostId: string;
  totalVotes: number;
  totalBookmarks: number;
  totalComments: number;
};

/**
 * The live half of the split, resolved per request for exactly the posts on the
 * current page — never cached.
 *
 * It carries everything volatile:
 *  - viewer state: did *I* vote / bookmark / follow?
 *  - the materialized counters, which change on every vote/bookmark/comment.
 *
 * Everything else (content, author, media, frozen/appeal flags) comes from the
 * cached public batch.
 */
export type SocialPostLiveOverlay = {
  viewerId: string;
  votes: { socialPostId: string; voteType: VoteType }[];
  bookmarks: { id: string; socialPostId: string }[];
  /** Author ids the viewer follows (drives the header Follow button). */
  following: string[];
  counters: SocialPostLiveCounters[];
};

/**
 * Card-ready feed item: cached public content + live viewer state.
 *
 * `author.followers` keeps the shape `SocialPostCard` already reads
 * (`followers.length > 0` => following), and `votes` / `bookmarks` are always
 * arrays so the card never sees an ambiguous `false`.
 */
export type SocialPostFeedItem = Omit<PublicSocialPost, "mentions" | "author"> & {
  mentions: MentionUser[] | null;
  votes: { voteType: VoteType }[];
  bookmarks: { id: string }[];
  author: PublicSocialPost["author"] & { followers: { followerId: string }[] };
};

/**
 * Slim, viewer-agnostic projection for the detail page's `generateMetadata`.
 *
 * Why it exists: `generateMetadata` and the page body call `getPost` with
 * *different* argument tuples (`getPost(id)` vs `getPost(id, viewerId)`), so
 * React's request-level `cache()` cannot dedupe them and the full post query —
 * which also loads a page of comments plus votes, bookmarks and followers —
 * ran twice per detail page request. Metadata needs none of that.
 */
export const POST_METADATA_SELECT = {
  id: true,
  content: true,
  imageUrl: true,
  createdAt: true,
  editedAt: true,
  author: { select: { name: true } },
} as const satisfies Prisma.SocialPostSelect;

/** Viewer-agnostic metadata row for the detail page. */
export type PostMetadata = Prisma.SocialPostGetPayload<{
  select: typeof POST_METADATA_SELECT;
}>;
