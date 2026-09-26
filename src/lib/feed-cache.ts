/**
 * Tri-Split feed data access.
 *
 * ┌───────────────────────────────────────────────────────────────┐
 * │ 1. Public batch  — `getCachedPublicFeed`                      │
 * │    Viewer-agnostic rows, shared by every visitor, keyed by     │
 * │    `(limit, cursor)` and tagged `feed-public`.                  │
 * ├───────────────────────────────────────────────────────────────┤
 * │ 2. Live overlay  — `getSocialPostLiveOverlay`                  │
 * │    Viewer state + materialized counters, per viewer, always    │
 * │    ONE SQL statement (the prod pg pool is `max: 1`, so N        │
 * │    "parallel" Prisma queries would serialise into N round       │
 * │    trips — see `@/lib/db`).                                    │
 * └───────────────────────────────────────────────────────────────┘
 *
 * Freshness contract (documented, not accidental):
 *  - Viewer state is never cached, so a vote/bookmark/follow can never be
 *    reverted by a stale cache.
 *  - Signed-in viewers get live `totalVotes` / `totalBookmarks` /
 *    `totalComments` in the same statement as their viewer state (the counters
 *    are overlay fields, not cached-batch fields), so nothing they see is stale.
 *  - Signed-out viewers read counters from the cached batch, which may lag by at
 *    most {@link FEED_PUBLIC_REVALIDATE_SECONDS} — the standard public-feed
 *    eventual-consistency window, and the price of not adding a round trip to
 *    the highest-volume path. It is a backstop for drift we do not invalidate
 *    on (counters, embedded author fields, cron writes), not the primary
 *    freshness mechanism: real content changes purge the tag explicitly.
 *  - Author- and moderator-initiated changes (publish / edit / delete / freeze)
 *    call {@link revalidatePublicFeed} for an immediate purge.
 */
import { revalidateTag, unstable_cache } from "next/cache";
import { Prisma, VoteType } from "@prisma/client";

import prisma from "@/lib/db";
import {
  POST_METADATA_SELECT,
  PUBLIC_SOCIAL_POST_SELECT,
  type CachedPublicSocialPost,
  type PostMetadata,
  type PublicSocialPost,
  type SocialPostLiveOverlay,
} from "@/types/feed";

/** Tag shared by every cached public feed page. */
export const FEED_PUBLIC_TAG = "feed-public";

/**
 * How long a cached public feed page may be served before it is regenerated.
 *
 * WHO IS AFFECTED BY THIS WINDOW:
 *  - Signed-IN viewers: not at all. `getSocialPostLiveOverlay` returns their
 *    vote / bookmark / follow state AND fresh counters in one statement on every
 *    page load, so they always see live numbers regardless of this TTL.
 *  - Signed-OUT visitors: they have no overlay, so they read the counters and
 *    author fields embedded in the cached batch. Those can lag by at most this
 *    many seconds.
 *
 * Content mutations (publish / edit / delete / freeze) call
 * {@link revalidatePublicFeed} and purge the tag immediately, so this TTL is NOT
 * what governs how quickly posts appear or disappear. It only bounds the drift we
 * deliberately refuse to invalidate on:
 *
 *  - Materialized counters, which change on every vote/bookmark/comment.
 *    Invalidating per interaction would turn a burst of votes into a cache
 *    stampede against a free-tier database.
 *  - Embedded author fields (name / handle / avatar / verification badge),
 *    which drift whenever a scholar edits their profile.
 *  - Rows mutated by background crons (e.g. trending score recalculation).
 *
 * It is also the safety net for any missed invalidation (a failed purge, a
 * direct dashboard edit, a cron write) — without a TTL such a miss would
 * desynchronise the public feed indefinitely.
 *
 * 5 minutes is the compromise: a signed-out visitor's counts are at most
 * 5 minutes behind (imperceptible), while cutting cached-page regenerations by
 * 10x versus the previous 30s setting. Lower it if staleness becomes
 * user-visible; raise it if the read cost ever matters more than freshness.
 */
export const FEED_PUBLIC_REVALIDATE_SECONDS = 5 * 60;

/**
 * Upper bound on a requested page size. The page size is part of the cache key,
 * so clamping stops a client from minting unbounded cache keys (and unbounded
 * payloads) by passing arbitrary limits to the server action.
 */
export const FEED_PAGE_SIZE_MAX = 50;

export const FEED_PAGE_SIZE_DEFAULT = 10;

/** Clamps a client-supplied page size into the cache-key-safe range. */
export function normalizeFeedPageSize(requested?: number): number {
  if (typeof requested !== "number" || !Number.isFinite(requested)) {
    return FEED_PAGE_SIZE_DEFAULT;
  }
  return Math.min(Math.max(Math.trunc(requested), 1), FEED_PAGE_SIZE_MAX);
}

/** `unstable_cache` persists via `JSON.stringify`, so dates must not survive as Date. */
function toCachedPublicSocialPost(
  post: PublicSocialPost,
): CachedPublicSocialPost {
  return {
    ...post,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
    editedAt: post.editedAt ? post.editedAt.toISOString() : null,
  };
}

/**
 * The viewer-agnostic page loader.
 *
 * Ordering + cursor semantics are identical to the dynamic loader below, so a
 * cursor minted from one path is valid for the other. `orderBy: createdAt desc`
 * combined with `cursor: { id }` lets Prisma resolve the cursor row's ordering
 * value; `skip: 1` drops the cursor row itself.
 */
async function loadPublicFeedPage(
  limit: number,
  cursor?: string,
): Promise<CachedPublicSocialPost[]> {
  const posts = await prisma.socialPost.findMany({
    where: { isDeleted: false }, // RULE 4: soft-deleted posts never reach the feed
    select: PUBLIC_SOCIAL_POST_SELECT,
    orderBy: { createdAt: "desc" },
    take: limit,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  return posts.map(toCachedPublicSocialPost);
}

/**
 * Cached public feed page.
 *
 * Tagged with {@link FEED_PUBLIC_TAG} so `revalidateTag`/`updateTag` can purge
 * it, and expires every {@link FEED_PUBLIC_REVALIDATE_SECONDS} so counters
 * converge without any per-vote invalidation.
 */
export const getCachedPublicFeed = unstable_cache(
  loadPublicFeedPage,
  [FEED_PUBLIC_TAG],
  {
    tags: [FEED_PUBLIC_TAG],
    revalidate: FEED_PUBLIC_REVALIDATE_SECONDS,
  },
);

export type DynamicFeedParams = {
  viewerId?: string;
  /** "following" tab: restrict to authors this viewer follows. */
  followingOnly?: boolean;
  query?: string;
  limit: number;
  cursor?: string;
};

/**
 * The personalized ("following" / search) page loader.
 *
 * Never cached: the result depends on the viewer and/or the search string.
 * It reuses the same select and ordering as the cached loader so both paths
 * produce identical item shapes.
 */
export async function loadDynamicFeedPage({
  viewerId,
  followingOnly = false,
  query,
  limit,
  cursor,
}: DynamicFeedParams): Promise<CachedPublicSocialPost[]> {
  // Signed-out visitors have nothing to follow: short-circuit instead of
  // running a query that cannot match anything.
  if (followingOnly && !viewerId) return [];

  const trimmedQuery = query?.trim();
  const hasQuery = Boolean(trimmedQuery);

  const posts = await prisma.socialPost.findMany({
    where: {
      isDeleted: false,
      // RULE 2/RULE 5: a relation filter (served by the `Follows(followerId,
      // followingId)` primary key) replaces loading every followed id into
      // memory and posting it back as an unbounded `IN (...)`.
      ...(followingOnly && viewerId
        ? { author: { followers: { some: { followerId: viewerId } } } }
        : {}),
      ...(hasQuery
        ? {
            OR: [
              { content: { contains: trimmedQuery, mode: "insensitive" } },
              { author: { name: { contains: trimmedQuery, mode: "insensitive" } } },
              { author: { handle: { contains: trimmedQuery, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    select: PUBLIC_SOCIAL_POST_SELECT,
    orderBy: { createdAt: "desc" },
    take: limit,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  return posts.map(toCachedPublicSocialPost);
}

/** Raw shape returned by the single-statement live-overlay query. */
type LiveOverlayRow = {
  votes: { socialPostId: string; voteType: string }[] | null;
  bookmarks: { id: string; socialPostId: string }[] | null;
  following: string[] | null;
  counters: {
    socialPostId: string;
    totalVotes: number;
    totalBookmarks: number;
    totalComments: number;
  }[] | null;
};

/**
 * Resolves everything volatile for one page of posts in a **single** indexed
 * statement: the viewer's vote / bookmark / follow state *and* each post's
 * materialized counters.
 *
 * Why raw SQL: the production pool is `max: 1` (one connection per lambda, to
 * protect Supavisor), so N "parallel" Prisma queries execute sequentially — N
 * round trips. Aggregating into one row costs one. The counters ride along here
 * instead of being read from the cached batch so that a signed-in viewer never
 * sees a stale number.
 *
 * Indexes used (RULE 5):
 *  - `SocialVote(socialPostId, userId)` unique — probed per post id.
 *  - `SocialPostBookmark(userId, createdAt desc)` and `(socialPostId, userId)`.
 *  - `Follows(followerId, followingId)` primary key.
 *  - `SocialPost(id)` primary key for the counter triple.
 */
export async function getSocialPostLiveOverlay(
  viewerId: string,
  postIds: string[],
  authorIds: string[],
): Promise<SocialPostLiveOverlay> {
  if (postIds.length === 0 || authorIds.length === 0) {
    return { viewerId, votes: [], bookmarks: [], following: [], counters: [] };
  }

  const rows = await prisma.$queryRaw<LiveOverlayRow[]>`
    SELECT
      COALESCE((
        SELECT json_agg(json_build_object('socialPostId', v."socialPostId", 'voteType', v."voteType"))
        FROM "SocialVote" v
        WHERE v."userId" = ${viewerId}
          AND v."socialPostId" IN (${Prisma.join(postIds)})
      ), '[]'::json) AS votes,
      COALESCE((
        SELECT json_agg(json_build_object('id', b."id", 'socialPostId', b."socialPostId"))
        FROM "SocialPostBookmark" b
        WHERE b."userId" = ${viewerId}
          AND b."socialPostId" IN (${Prisma.join(postIds)})
      ), '[]'::json) AS bookmarks,
      COALESCE((
        SELECT json_agg(f."followingId")
        FROM "Follows" f
        WHERE f."followerId" = ${viewerId}
          AND f."followingId" IN (${Prisma.join(authorIds)})
      ), '[]'::json) AS following,
      COALESCE((
        SELECT json_agg(json_build_object(
          'socialPostId', p."id",
          'totalVotes', p."totalVotes",
          'totalBookmarks', p."totalBookmarks",
          'totalComments', p."totalComments"
        ))
        FROM "SocialPost" p
        WHERE p."id" IN (${Prisma.join(postIds)})
      ), '[]'::json) AS counters
  `;

  const row = rows[0];
  if (!row) {
    return { viewerId, votes: [], bookmarks: [], following: [], counters: [] };
  }

  return {
    viewerId,
    // `voteType` arrives as a JSON string; keep only known enum members so
    // schema drift can never inject an invalid value into the UI.
    votes: (row.votes ?? []).flatMap((vote) =>
      vote.voteType === VoteType.UPVOTE || vote.voteType === VoteType.DOWNVOTE
        ? [
            {
              socialPostId: vote.socialPostId,
              voteType: vote.voteType as VoteType,
            },
          ]
        : [],
    ),
    bookmarks: row.bookmarks ?? [],
    following: row.following ?? [],
    // pg parses the `json_agg` payload, but coerce defensively so a driver or
    // schema change can never put a string into a numeric counter.
    counters: (row.counters ?? []).map((counters) => ({
      socialPostId: counters.socialPostId,
      totalVotes: Number(counters.totalVotes) || 0,
      totalBookmarks: Number(counters.totalBookmarks) || 0,
      totalComments: Number(counters.totalComments) || 0,
    })),
  };
}

/**
 * Purges every cached public feed page.
 *
 * `{ expire: 0 }` is the immediate, blocking invalidation: the next visitor
 * waits for fresh data. The alternative `"max"` profile is
 * stale-while-revalidate, which would keep serving a deleted or frozen post —
 * not acceptable for author deletions or moderation. The single-argument
 * `revalidateTag(tag)` form is deprecated in Next 16.
 *
 * Works from Server Actions and Route Handlers, so an author deleting a post
 * and an admin freezing one both resolve through this one helper.
 */
export function revalidatePublicFeed(): void {
  revalidateTag(FEED_PUBLIC_TAG, { expire: 0 });
}

/**
 * Viewer-agnostic metadata read for the detail page (SEO + social previews).
 *
 * Deliberately uncached: it is a single primary-key lookup, and a stale
 * `<title>`/description after an edit is worse than the saved round trip. Its
 * job is to keep `generateMetadata` from re-running the full `getPost` query,
 * which also loads a page of comments plus votes, bookmarks and followers.
 */
export async function getPostMetadata(
  id: string,
): Promise<PostMetadata | null> {
  return prisma.socialPost.findUnique({
    where: { id, isDeleted: false },
    select: POST_METADATA_SELECT,
  });
}
