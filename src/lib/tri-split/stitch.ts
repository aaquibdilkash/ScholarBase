/**
 * Pure stitching for the Tri-Split list architecture.
 *
 * Kept free of Prisma / Next imports so the mapping (cached viewer-agnostic row
 * + live viewer snapshot -> card-ready item) is unit-testable without a
 * database. One implementation serves every module; per-module hooks cover
 * the fields that genuinely differ (mention columns, `isFollowed`, nested
 * vs top-level follow state).
 */
import type { VoteType } from "@prisma/client";

/** The live half of the split for one page of rows. */
export type LiveOverlay = {
  /** `null` for signed-out visitors: counters only, no viewer state. */
  viewerId: string | null;
  votes: { id: string; voteType: VoteType }[];
  bookmarks: { id: string; rowId: string }[];
  following: string[];
  counters: { id: string; values: Record<string, number> }[];
};

/** Per-module description of how to fold a cached row with the live overlay. */
export type StitchOptions<TCached, _TItem = unknown> = {
  /** Overlay rows are keyed by this id (the row's primary key). */
  getRowId: (row: TCached) => string;
  /** Follow state is resolved against this author id. */
  getAuthorId: (row: TCached) => string;
  /** Counter column names to overlay, e.g. `["totalVotes", "totalBookmarks"]`. */
  counterKeys: readonly string[];
  /** Revive the ISO date strings produced by the cache serializer. */
  rehydrate: (row: TCached) => Record<string, unknown>;
  /** Module-specific tail applied after the generic overlay. */
  normalize?: (row: TCached) => Record<string, unknown>;
  /**
   * Where stitched follow state lands. Defaults to `author.followers` (the
   * shape every content card already reads). The scholar directory overrides
   * this with `"self"` because its follow state is top-level, and it wants an
   * explicit `isFollowed` boolean rather than the leaky raw array.
   */
  followTarget?: "author" | "self";
};

/**
 * Folds one page of cached rows with the live overlay.
 *
 * Contract:
 *  - Viewer state (votes / bookmarks / follows) is NEVER read from the cache.
 *    It exists only in the overlay, so a stale cache can never revert it.
 *  - Counters fall back to the cached value when the overlay has no row for
 *    them (signed-out visitors, or a row deleted between the two reads).
 *  - O(1) map/set lookups throughout, so this stays linear in page size.
 */
export function stitchLiveState<TCached, TItem>(
  rows: TCached[],
  overlay: LiveOverlay | null,
  options: StitchOptions<TCached, TItem>,
): TItem[] {
  const {
    getRowId,
    getAuthorId,
    counterKeys,
    rehydrate,
    normalize,
    followTarget = "author",
  } = options;

  const voteByRowId = new Map<string, VoteType>();
  const bookmarkByRowId = new Map<string, string>();
  const countersByRowId = new Map<string, Record<string, number>>();

  for (const vote of overlay?.votes ?? []) {
    voteByRowId.set(vote.id, vote.voteType);
  }
  for (const bookmark of overlay?.bookmarks ?? []) {
    bookmarkByRowId.set(bookmark.rowId, bookmark.id);
  }
  for (const counters of overlay?.counters ?? []) {
    countersByRowId.set(counters.id, counters.values);
  }

  const followedIds = new Set(overlay?.following ?? []);
  const viewerId = overlay?.viewerId;
  const isFollowing = (authorId: string) =>
    viewerId != null && followedIds.has(authorId);

  return rows.map((cached) => {
    const rowId = getRowId(cached);
    const authorId = getAuthorId(cached);
    const liveCounters = countersByRowId.get(rowId);
    const voteType = voteByRowId.get(rowId);
    const bookmarkId = bookmarkByRowId.get(rowId);

    // Counter overlay: live wins, the cached value is the fallback.
    const counters: Record<string, number> = {};
    for (const key of counterKeys) {
      const live = liveCounters?.[key];
      const cachedValue = (cached as Record<string, unknown>)[key];
      counters[key] =
        live ?? (typeof cachedValue === "number" ? cachedValue : 0);
    }

    const revived = rehydrate(cached);

    const base: Record<string, unknown> = {
      ...revived,
      ...counters,
      votes: voteType ? [{ voteType }] : [],
      bookmarks: bookmarkId ? [{ id: bookmarkId }] : [],
    };

    const tail = normalize?.(cached) ?? {};

    if (followTarget === "self") {
      return { ...base, ...tail, isFollowed: isFollowing(authorId) } as TItem;
    }

    return {
      ...base,
      ...tail,
      author: {
        ...(revived as { author?: Record<string, unknown> }).author,
        followers:
          viewerId != null && isFollowing(authorId)
            ? [{ followerId: viewerId }]
            : [],
      },
    } as TItem;
  });
}
