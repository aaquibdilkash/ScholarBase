"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { LoadMoreSentinel } from "@/components/layout/LoadMoreSentinel";

export function AppendMoreList<T>({
  initialItems,
  loadMore: loadMoreItems,
  renderItem,
  chunkSize = 10,
  className,
  emptyMessage,
  emptyState,
}: {
  initialItems: T[];
  loadMore: (cursor?: string) => Promise<T[]>;
  renderItem: (item: T) => ReactNode;
  chunkSize?: number;
  className?: string;
  emptyMessage?: string;
  /** Optional richer empty-state node; overrides `emptyMessage` when provided. */
  emptyState?: ReactNode;
}) {
  const [items, setItems] = useState<T[]>(initialItems);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(initialItems.length === chunkSize);

  useEffect(() => {
    setItems(initialItems);
    setCursor(
      initialItems.length === chunkSize
        ? (initialItems[initialItems.length - 1] as unknown as { id?: string })?.id ?? null
        : null,
    );
    setHasMore(initialItems.length === chunkSize);
  }, [initialItems, chunkSize]);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      const newItems = await loadMoreItems(cursor ?? undefined);
      setItems((current) => [...current, ...newItems]);
      const hasNextPage = newItems.length === chunkSize;
      setCursor(hasNextPage ? (newItems[newItems.length - 1] as unknown as { id?: string })?.id ?? null : null);
      setHasMore(hasNextPage);
    } catch {
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [chunkSize, cursor, hasMore, loadMoreItems, loading]);

  return (
    <div className={className}>
      {items.length === 0 && (emptyState ?? emptyMessage) ? (
        emptyState ?? (
          <div className="rounded-[24px] border border-dashed border-slate-200 bg-white/80 py-12 text-center">
            <p className="font-medium text-slate-500">{emptyMessage}</p>
          </div>
        )
      ) : (
        <>
          {items.map((item) => renderItem(item))}
          <LoadMoreSentinel onVisible={loadMore} disabled={!hasMore || loading} />
          {loading ? <div className="py-4 text-center text-sm text-slate-500">Loading more...</div> : null}
        </>
      )}
    </div>
  );
}
