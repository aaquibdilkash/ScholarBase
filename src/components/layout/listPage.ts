/**
 * Shared cursor-pagination contracts for list components.
 *
 * Two loader shapes are supported so lists backed by different server actions
 * can share one component:
 *  - `T[]`               → cursor is derived from the last item (`id` by default)
 *  - `CursorPage<T>`     → the server action returns an explicit `nextCursor`
 *                          and/or `hasMore` (used when the cursor is not the
 *                          row `id`, e.g. the followers/following endpoints
 *                          which paginate on `createdAt`).
 */
export type CursorPage<T> = {
  items: T[];
  nextCursor?: string | null;
  hasMore?: boolean;
};

/** A loader may return either a bare array or an explicit cursor page. */
export type ListPage<T> = T[] | CursorPage<T>;

/** Normalises either loader shape into a `CursorPage`. */
export function normalizePage<T>(page: ListPage<T>): CursorPage<T> {
  if (Array.isArray(page)) return { items: page };
  return page;
}

/** Default cursor derivation: the `id` of the last item in the page. */
export function defaultGetCursor<T>(items: T[]): string | undefined {
  const last = (items[items.length - 1] as { id?: string } | undefined);
  return last?.id ?? undefined;
}

/**
 * How long a list's React Query entry is considered fresh.
 *
 * Five minutes, matching `LIST_REVALIDATE_SECONDS` in `lib/tri-split/cache.ts`
 * — the server cache underneath expires on the same clock, so a client entry and
 * the rows behind it never disagree about what "current" means. The value is
 * restated here rather than imported because that module pulls in `next/cache`,
 * which cannot cross into a client bundle; `test/tri-split/cache.test.ts` pins
 * the two to the same number.
 */
export const LIST_REVALIDATE_MS = 5 * 60 * 1000;
