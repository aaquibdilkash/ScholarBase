"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { LoadMoreSentinel } from "@/components/layout/LoadMoreSentinel";
import { defaultGetCursor, normalizePage } from "@/components/layout/listPage";
import type { ListPage } from "@/components/layout/listPage";

export type ListRenderContext<T> = {
  /** Patch an item in place, e.g. toggling a locally-owned `isFollowing` flag. */
  updateItem: (id: string, patch: Partial<T>) => void;
};

export function AppendMoreList<T extends { id: string }>({
  initialItems,
  loadMore: loadMoreItems,
  renderItem,
  chunkSize = 10,
  className,
  emptyMessage,
  emptyState,
  getCursor = defaultGetCursor,
  reloadToken,
  onLoadError,
  loadingIndicator,
}: {
  initialItems: T[];
  loadMore: (cursor?: string) => Promise<ListPage<T>>;
  renderItem: (item: T, context: ListRenderContext<T>) => ReactNode;
  chunkSize?: number;
  className?: string;
  emptyMessage?: string;
  /** Optional richer empty-state node; overrides `emptyMessage` when provided. */
  emptyState?: ReactNode;
  /**
   * Derives the pagination cursor from a page. Defaults to the last item's `id`.
   * Override for endpoints that paginate on another column (e.g. `createdAt`).
   */
  getCursor?: (items: T[]) => string | undefined;
  /**
   * When this value changes, the list is reset and page 1 is re-fetched via
   * `loadMore(undefined)`. Use for client-owned lists (e.g. a modal) that fetch
   * on open rather than receiving server-provided `initialItems`.
   */
  reloadToken?: string | number | null;
  /** Called when a page request fails, instead of silently stopping pagination. */
  onLoadError?: (error: unknown) => void;
  /** Custom "loading more" indicator; defaults to a plain text row. */
  loadingIndicator?: ReactNode;
}) {
  const [items, setItems] = useState<T[]>(initialItems);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(initialItems.length === chunkSize);

  // Refs keep `loadMore` (and therefore the IntersectionObserver callback)
  // stable while still reading the latest values. Assigned in an effect because
  // React forbids mutating refs during render.
  const itemsRef = useRef(items);
  const getCursorRef = useRef(getCursor);
  const loadMoreRef = useRef(loadMoreItems);
  const onLoadErrorRef = useRef(onLoadError);
  const loadingRef = useRef(loading);
  useEffect(() => {
    itemsRef.current = items;
    getCursorRef.current = getCursor;
    loadMoreRef.current = loadMoreItems;
    onLoadErrorRef.current = onLoadError;
    loadingRef.current = loading;
  });

  // Re-seed from new server data (e.g. a search/tab change upstream).
  useEffect(() => {
    setItems(initialItems);
    setHasMore(initialItems.length === chunkSize);
    setCursor(
      initialItems.length === chunkSize ? getCursorRef.current(initialItems) : undefined,
    );
  }, [initialItems, chunkSize]);

  const loadMore = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const page = normalizePage(await loadMoreRef.current(cursor));
      const more = page.hasMore ?? page.items.length === chunkSize;

      // Dedupe defensively so a re-render or a re-fired observer callback can
      // never duplicate rows.
      setItems((current) => {
        const seen = new Set(current.map((item) => item.id));
        return [...current, ...page.items.filter((item) => !seen.has(item.id))];
      });
      setHasMore(more);
      setCursor(more ? (page.nextCursor ?? getCursorRef.current(page.items)) : undefined);
    } catch (error) {
      onLoadErrorRef.current?.(error);
      setHasMore(false);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [chunkSize, cursor]);

  // Imperative reload: reset and pull page 1. Driven by `reloadToken` so the
  // caller controls *when* (e.g. when a modal opens) without an effect loop.
  const previousTokenRef = useRef(reloadToken);
  useEffect(() => {
    if (previousTokenRef.current === reloadToken) return;
    previousTokenRef.current = reloadToken;
    if (reloadToken === null || reloadToken === undefined) return;

    let cancelled = false;
    loadingRef.current = true;
    setItems([]);
    setCursor(undefined);
    setHasMore(false);
    setLoading(true);

    void (async () => {
      try {
        const page = normalizePage(await loadMoreRef.current(undefined));
        if (cancelled) return;
        const more = page.hasMore ?? page.items.length === chunkSize;
        setItems(page.items);
        setHasMore(more);
        setCursor(more ? (page.nextCursor ?? getCursorRef.current(page.items)) : undefined);
      } catch (error) {
        if (cancelled) return;
        onLoadErrorRef.current?.(error);
        setItems([]);
        setHasMore(false);
      } finally {
        if (cancelled) return;
        loadingRef.current = false;
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [reloadToken, chunkSize]);

  const updateItem = useCallback((id: string, patch: Partial<T>) => {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }, []);

  const showEmpty = items.length === 0 && !loading;

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
          {items.map((item) => renderItem(item, { updateItem }))}
          <LoadMoreSentinel onVisible={loadMore} disabled={!hasMore || loading} />
          {loading
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
