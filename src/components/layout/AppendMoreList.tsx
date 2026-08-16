"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { LoadMoreSentinel } from "@/components/layout/LoadMoreSentinel";

type LoadMoreParams = Record<string, string | undefined>;

export function AppendMoreList<T>({
  initialItems,
  resource,
  renderItem,
  params,
  chunkSize = 10,
  className,
}: {
  initialItems: T[];
  resource: string;
  renderItem: (item: T) => ReactNode;
  params?: LoadMoreParams;
  chunkSize?: number;
  className?: string;
}) {
  const [items, setItems] = useState<T[]>(initialItems);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(initialItems.length === chunkSize);

  useEffect(() => {
    setItems(initialItems);
    setCursor(initialItems.length === chunkSize ? (initialItems[initialItems.length - 1] as any)?.id : null);
    setHasMore(initialItems.length === chunkSize);
  }, [initialItems, chunkSize]);

  const loadMore = useCallback(async () => {
      if (loading || !hasMore) return;
      setLoading(true);
    try {
      const search = new URLSearchParams();
      if (cursor) search.set("cursor", cursor);
      Object.entries(params ?? {}).forEach(([key, value]) => {
        if (value) search.set(key, value);
      });
      const response = await fetch(`/api/load-more/${resource}?${search.toString()}`);
      if (!response.ok) return;
      const data = (await response.json()) as { items: T[]; hasMore: boolean; nextCursor: string | null };
      setItems((current) => [...current, ...data.items]);
      setCursor(data.nextCursor);
      setHasMore(data.hasMore);
    } finally {
      setLoading(false);
    }
  }, [chunkSize, cursor, hasMore, loading, params, resource]);

  return (
    <div className={className}>
      {items.map((item) => renderItem(item))}
      <LoadMoreSentinel onVisible={loadMore} disabled={!hasMore || loading} />
      {loading ? <div className="py-4 text-center text-sm text-slate-500">Loading more...</div> : null}
    </div>
  );
}
