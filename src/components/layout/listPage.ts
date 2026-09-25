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
  const last = items[items.length - 1] as { id?: string } | undefined;
  return last?.id ?? undefined;
}
