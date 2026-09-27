"use client";

import { useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { Carousel } from "./Carousel";

export interface PagedCarouselProps<T> {
  /**
   * React Query key owning the loaded slice. Card components mutate this key
   * (remove on delete, insert on create), so it must be stable per entity —
   * `["reviews", journalId]`, not a fresh literal per row.
   */
  queryKey: QueryKey;
  /** Server-rendered first page, painted before any client fetch. */
  initialItems: T[];
  /**
   * Materialized total for the entity (RULE 2). Drives `hasMore`, so pass the
   * *reactive* count when a sibling component keeps a live copy in the cache.
   */
  totalCount: number;
  /** Offset pager: receives the number of items already loaded. */
  fetchPage: (skip: number, take: number) => Promise<T[]>;
  /** Items fetched per right-arrow click. One full-width slide per fetch. */
  pageSize?: number;
  /** Noun used in the console message when a page fails to load. */
  errorLabel?: string;
  /** Render one slide. `renderItem` owns the React key. */
  renderItem: (item: T) => ReactNode;
}

/**
 * A `Carousel` that pages itself through a React Query list.
 *
 * The detail pages for supervisors (recommendations) and journals (reviews) are
 * the same component with a different card in the slide: seed one item from the
 * server, let the right arrow pull the next one in, and append it to the cache so
 * a later visit to the same page starts with everything already read. That
 * duplication is why this exists — the two rails had drifted into a vertical list
 * and a carousel respectively.
 *
 * Paging is offset-based rather than cursor-based: the per-entity count is
 * already materialized on the row, so there is no cursor to thread through the
 * card components, and the offset advances by what was fetched — never by what
 * survives in the cache. A delete drops a row from the cache mid-paging, and an
 * offset read off the cache would then re-request a slide that is already on
 * screen; the dedup below would discard it and the rail would stall one row
 * short of the end.
 */
export function PagedCarousel<T extends { id: string }>({
  queryKey,
  initialItems,
  totalCount,
  fetchPage,
  pageSize = 1,
  errorLabel = "items",
  renderItem,
}: PagedCarouselProps<T>) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  // Offset of the next page: how many items this rail has *fetched*, not how
  // many are in the cache. A delete removes a row from the cache, so a
  // cache-length offset would re-request a row already on screen and the dedup
  // below would drop it, stalling paging. See the note on the component.
  const fetchedCount = useRef(initialItems.length);
  // Latched once a page comes back empty. `totalCount` is a materialized
  // counter that can run ahead of what this query can actually return (a
  // filtered or soft-deleted row still counts), and comparing `items.length`
  // against it alone would leave `hasMore` true forever — the arrow would stay on
  // screen with no card behind it, and every click would refetch the same empty
  // page. Latching is what lets the arrow disappear.
  const [exhausted, setExhausted] = useState(false);

  const { data: items = [] } = useQuery<T[]>({
    queryKey,
    queryFn: () => fetchPage(0, pageSize),
    initialData: initialItems,
    // The cache is the source of truth for this rail. Every mutation path keeps
    // it in sync, and a default `staleTime: 0` would refetch page 0 on every
    // mount — throwing away the slides the reader already paged through just
    // for navigating back to the page. A hard reload starts from an empty cache
    // and re-seeds from the server render, which is where fresh data enters.
    staleTime: Infinity,
  });

  const loadMore = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const newItems = await fetchPage(fetchedCount.current, pageSize);
      if (newItems.length > 0) {
        fetchedCount.current += newItems.length;
        queryClient.setQueryData<T[]>(queryKey, (prev: T[] = []) => {
          const existingIds = new Set(prev.map((item) => item.id));
          return [
            ...prev,
            ...newItems.filter((item) => !existingIds.has(item.id)),
          ];
        });
      } else {
        setExhausted(true);
      }
    } catch (err) {
      console.error(`Failed to load more ${errorLabel}:`, err);
    } finally {
      setLoading(false);
    }
  };

  const hasMore = !exhausted && items.length < totalCount;

  return (
    <div className="relative">
      <Carousel onLoadMore={hasMore ? loadMore : undefined} hasMore={hasMore}>
        {items.map((item) => renderItem(item))}
      </Carousel>
      {loading && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <div className="flex items-center gap-2 rounded-full bg-slate-900/80 px-4 py-2 text-sm font-medium text-white shadow-lg">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            Loading more...
          </div>
        </div>
      )}
    </div>
  );
}
