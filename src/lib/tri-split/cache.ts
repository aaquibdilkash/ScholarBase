/**
 * Cached, viewer-agnostic page loading for Tri-Split lists.
 *
 * `unstable_cache` persists via `JSON.stringify`, so every `Date` comes back as
 * an ISO string. `serializeDates` walks the row and converts the columns the
 * module declares as dates; `stitchLiveState` revives them on the way out.
 */
import { unstable_cache } from "next/cache";

/**
 * How long a cached list page may be served before it is regenerated.
 *
 * WHO IS AFFECTED BY THIS WINDOW:
 *  - Signed-IN viewers: not at all. The live overlay returns their vote /
 *    bookmark / follow state AND fresh counters in one statement per page load.
 *  - Signed-OUT visitors: no overlay, so they read the counters and author
 *    fields embedded in the cached batch. Those can lag by at most this much.
 *
 * Content mutations (publish / edit / delete / freeze) purge the module's tag
 * immediately, so this TTL is NOT what governs how quickly content appears or
 * disappears. It only bounds drift we deliberately refuse to invalidate on:
 *  - Materialized counters, which change on every vote/bookmark/comment.
 *    Invalidating per interaction would turn a vote burst into a cache
 *    stampede against a free-tier database.
 *  - Embedded author fields, which drift on profile edits.
 *  - Rows mutated by background crons (e.g. trending score recalculation).
 *
 * It is also the safety net for any missed invalidation (a failed purge, a
 * direct dashboard edit, a cron write) — without a TTL such a miss would
 * desynchronise the public list indefinitely.
 */
export const LIST_REVALIDATE_SECONDS = 5 * 60;

/**
 * Upper bound on a requested page size. The page size is part of the cache
 * key, so clamping stops a client from minting unbounded cache keys (and
 * unbounded payloads) by passing an arbitrary limit to a server action.
 */
export const LIST_PAGE_SIZE_MAX = 50;
export const LIST_PAGE_SIZE_DEFAULT = 10;

/** Clamps a client-supplied page size into the cache-key-safe range. */
export function normalizePageSize(requested?: number): number {
  if (typeof requested !== "number" || !Number.isFinite(requested)) {
    return LIST_PAGE_SIZE_DEFAULT;
  }
  return Math.min(Math.max(Math.trunc(requested), 1), LIST_PAGE_SIZE_MAX);
}

/**
 * Converts the declared date columns of a row to ISO strings, recursively.
 *
 * Keys absent from the row are left absent — several modules do not select
 * `updatedAt`/`editedAt` at all, and stamping them as `null` here would add
 * fields the projection never asked for and change the cached payload shape.
 */
export function serializeDates<TRow>(
  row: TRow,
  dateKeys: readonly string[],
): TRow {
  if (dateKeys.length === 0) return row;
  const record = row as Record<string, unknown>;
  let out: Record<string, unknown> | null = null;
  for (const key of dateKeys) {
    if (!(key in record)) continue;
    out ??= { ...record };
    const value = out[key];
    if (value instanceof Date) {
      out[key] = value.toISOString();
    } else if (value === null || value === undefined) {
      out[key] = null;
    }
  }
  return (out ?? record) as TRow;
}

/**
 * Wraps a viewer-agnostic page loader in the shared cache policy.
 *
 * `keyParts` MUST include every input that changes the result (module tag,
 * ordering, sort mode, filters). A `sort` argument that changes the DB index
 * without appearing here would let a reputation-sorted request be served a
 * latest-sorted page.
 */
export function createCachedPage<TRow, TArgs extends unknown[]>(
  tag: string,
  loadPage: (...args: TArgs) => Promise<TRow[]>,
  options: { dateKeys?: readonly string[]; keyParts?: readonly string[] } = {},
) {
  const { dateKeys = [], keyParts = [] } = options;

  const cached = unstable_cache(
    async (...args: TArgs) => {
      const rows = await loadPage(...args);
      return rows.map((row) => serializeDates(row, dateKeys));
    },
    [tag, ...keyParts],
    { tags: [tag], revalidate: LIST_REVALIDATE_SECONDS },
  );

  return cached;
}
