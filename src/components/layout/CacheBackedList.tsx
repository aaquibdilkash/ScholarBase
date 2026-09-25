"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LoadMoreSentinel } from "@/components/layout/LoadMoreSentinel";
import { defaultGetCursor, normalizePage } from "@/components/layout/listPage";
import type { ListPage } from "@/components/layout/listPage";

/**
 * Cursor-paginated list whose items are owned by the React Query cache.
 *
 * Use this (not `AppendMoreList`) when other components mutate the same query
 * key, e.g. the `["feed", ...]` cache is written by `CreateSocialPostForm`
 * (prepend), `SocialPostCard` (filter), the post editor (replace) and
 * `CommentSection` (patch counters). Because the cached array is the single
 * source of truth, this component:
 *
 *  - stores a flat `T[]` under `queryKey` (the shape those writers expect),
 *  - derives the cursor from the cached items instead of component state, so an
 *    external prepend can never reset pagination back to page 1,
 *  - appends with `setQueryData` and de-duplicates by `id`,
 *  - only resets when the serialized query key changes (a real list swap).
 */
export function CacheBackedList<T extends { id: string }>({
  queryKey,
  initialItems,
  fetchPage,
  renderItem,
  chunkSize = 10,
  className,
  emptyMessage,
  emptyState,
  getCursor = defaultGetCursor,
  staleTime = 5 * 60 * 1000,
  onLoadError,
  loadingIndicator,
}: {
  queryKey: readonly unknown[];
  initialItems: T[];
  /** Loads one page. Called with `undefined` for the first page. */
  fetchPage: (cursor?: string) => Promise<ListPage<T>>;
  renderItem: (item: T, index: number) => ReactNode;
  chunkSize?: number;
  className?: string;
  emptyMessage?: string;
  emptyState?: ReactNode;
  getCursor?: (items: T[]) => string | undefined;
  staleTime?: number;
  onLoadError?: (error: unknown) => void;
  loadingIndicator?: ReactNode;
}) {
  const queryClient = useQueryClient();
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(initialItems.length === chunkSize);

  // Keep the latest props in refs so `loadMore` (and therefore the
  // IntersectionObserver callback) stays stable. Assigned in an effect because
  // React forbids mutating refs during render.
  const getCursorRef = useRef(getCursor);
  const fetchPageRef = useRef(fetchPage);
  const onLoadErrorRef = useRef(onLoadError);
  const loadingRef = useRef(false);
  useEffect(() => {
    getCursorRef.current = getCursor;
    fetchPageRef.current = fetchPage;
    onLoadErrorRef.current = onLoadError;
  });

  const { data: items = [] } = useQuery<T[]>({
    queryKey,
    queryFn: async () => {
      const page = normalizePage(await fetchPageRef.current(undefined));
      return page.items;
    },
    initialData: initialItems,
    staleTime,
    // Never silently drop already-appended pages on a background refetch.
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  // Reset pagination only on a genuine list swap (key change), never because
  // `initialItems` gained a new identity from a parent re-render.
  const keyString = JSON.stringify(queryKey);
  const previousKeyRef = useRef(keyString);
  useEffect(() => {
    if (previousKeyRef.current === keyString) return;
    previousKeyRef.current = keyString;
    setHasMore(initialItems.length === chunkSize);
  }, [keyString, initialItems, chunkSize]);

  const loadMore = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoadingMore(true);
    try {
      const current = queryClient.getQueryData<T[]>(queryKey) ?? [];
      // Derived from the live cache, so an externally prepended/deleted row
      // never invalidates our position in the list.
      const cursor = getCursorRef.current(current);
      const page = normalizePage(await fetchPageRef.current(cursor));
      const more = page.hasMore ?? page.items.length === chunkSize;

      if (page.items.length > 0) {
        queryClient.setQueryData<T[]>(queryKey, (old = []) => {
          const seen = new Set(old.map((item) => item.id));
          return [...old, ...page.items.filter((item) => !seen.has(item.id))];
        });
      }
      setHasMore(more);
    } catch (error) {
      onLoadErrorRef.current?.(error);
      setHasMore(false);
    } finally {
      loadingRef.current = false;
      setLoadingMore(false);
    }
  }, [queryKey, chunkSize, queryClient]);

  const showEmpty = items.length === 0 && !loadingMore;

  return (
    <div className={className}>
      {showEmpty ? (
        (emptyState ?? (
          <div className="rounded-[24px] border border-dashed border-slate-200 bg-white/80 py-12 text-center">
            <p className="font-medium text-slate-500">{emptyMessage}</p>
          </div>
        ))
      ) : (
        <>
          {items.map(renderItem)}
          <LoadMoreSentinel onVisible={loadMore} disabled={!hasMore || loadingMore} />
          {loadingMore
            ? (loadingIndicator ?? (
                <div className="py-4 text-center text-sm text-slate-500">
                  Loading more...
                </div>
              ))
            : null}
        </>
      )}
    </div>
  );
}
