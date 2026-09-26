/**
 * Scholar directory wiring.
 *
 * The one list that is NOT a content module, so it does not go through
 * `createContentList`. Two things make it different:
 *
 *  1. Dynamic ordering. `latest` and `reputation` sort by different indexed
 *     columns on `User` (`createdAt desc` vs `reputation desc`), so `sort` is
 *     part of the cache key — otherwise a reputation-sorted request could be
 *     served a latest-sorted page.
 *  2. Follow state is top-level, not nested under an author. The stitch emits
 *     an explicit `isFollowed` boolean and DROPS the raw `followers` array, so
 *     the leaky shape never reaches the cached-adjacent output.
 *
 * Counters (`reputation`, `followersCount`, `followingCount`) are overlaid live
 * for signed-in viewers and read from the cached batch for signed-out ones,
 * exactly like every other list.
 */
import { createTriSplitList } from "../index";

/** Cache tag for the viewer-agnostic scholar directory pages. */
export const SCHOLARS_PUBLIC_TAG = "scholars-public";

/** Cache-key discriminator, so each ordering gets its own cached pages. */

/** Cached-batch row: dates are ISO strings until the stitch revives them. */
type ScholarRow = {
  id: string;
  name: string | null;
  handle: string | null;
  avatarUrl: string | null;
  institutionVerifiedAt: string | null;
  bio: string | null;
  reputation: number;
  createdAt: string;
  followersCount: number;
  followingCount: number;
};

/** Card-ready row: dates revived, follow state resolved, counters overlaid. */
export type ScholarListItem = Omit<ScholarRow, "createdAt"> & {
  createdAt: Date;
  /** Live follow state. Always false for signed-out visitors. */
  isFollowed: boolean;
};

/**
 * Viewer-agnostic projection. Deliberately has no `followers` filter: that
 * relation IS the identity leak this refactor removes. Follow state arrives
 * from the live overlay instead.
 */
const SCHOLAR_SELECT = {
  id: true,
  name: true,
  handle: true,
  avatarUrl: true,
  institutionVerifiedAt: true,
  bio: true,
  reputation: true,
  createdAt: true,
  // RULE 6: materialized counters, not a live COUNT(*) subquery.
  followersCount: true,
  followingCount: true,
} as unknown as Record<string, unknown>;

const SCHOLAR_STITCH = {
  getRowId: (row: Record<string, unknown>) => row.id as string,
  // Follow state on a scholar row is keyed by the scholar's own id.
  getAuthorId: (row: Record<string, unknown>) => row.id as string,
  counterKeys: ["reputation", "followersCount", "followingCount"],
  rehydrate: (row: Record<string, unknown>) => ({
    ...row,
    createdAt: new Date(row.createdAt as string),
  }),
  // Top-level follow state, not nested under an author.
  followTarget: "self" as const,
};

/** Cache-key discriminator per ordering, so the two never share entries. */
export const SCHOLAR_SORT_KEY_PARTS = ["latest", "reputation"] as const;
export type ScholarSort = (typeof SCHOLAR_SORT_KEY_PARTS)[number];

/** Exported for tests: the fold rules the directory uses. */
export const SCHOLAR_STITCH_OPTIONS = SCHOLAR_STITCH;

const ORDER_BY = {
  latest: { createdAt: "desc" },
  reputation: { reputation: "desc", createdAt: "desc" },
} as const;

/**
 * One cached loader per ordering.
 *
 * `unstable_cache` fixes its key parts at creation time, so a dynamic `sort`
 * cannot be threaded through a single loader without risking a
 * reputation-sorted request being served latest-sorted rows. Two loaders, two
 * disjoint key spaces, no possibility of crossover.
 */
function buildVariant(sort: "latest" | "reputation") {
  return createTriSplitList<Record<string, unknown>, ScholarListItem>({
    tag: SCHOLARS_PUBLIC_TAG,
    model: "user",
    // RULE 3: soft-deleted (tombstoned) scholars never reach the directory.
    where: { isDeleted: false },
    // Discriminates the two orderings in the cache key.
    keyParts: [sort],
    select: SCHOLAR_SELECT,
    orderBy: ORDER_BY[sort],
    dateKeys: ["createdAt"],
    overlay: {
      row: "User",
      // Scholars have no votes, bookmarks or comments of their own.
      vote: null,
      bookmark: null,
      counterKeys: ["reputation", "followersCount", "followingCount"],
    },
    stitch: SCHOLAR_STITCH,
    buildWhere: (args) => {
      const query = typeof args.query === "string" ? args.query.trim() : "";
      if (!query) return {};
      return {
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { handle: { contains: query, mode: "insensitive" } },
          { bio: { contains: query, mode: "insensitive" } },
        ],
      };
    },
  });
}

const variants = {
  latest: buildVariant("latest"),
  reputation: buildVariant("reputation"),
};

/** Loads one page of the scholar directory for the current viewer. */
export function loadScholarsPage(args: {
  query?: string;
  sort?: "latest" | "reputation";
  pageSize?: number;
  cursor?: string;
}): Promise<ScholarListItem[]> {
  const sort = args.sort === "reputation" ? "reputation" : "latest";
  return variants[sort].fetchPage({
    query: args.query,
    pageSize: args.pageSize,
    cursor: args.cursor,
  });
}

/** Purges the cached scholar directory pages (both orderings). */
export function revalidateScholars(): void {
  variants.latest.revalidate();
  variants.reputation.revalidate();
}
