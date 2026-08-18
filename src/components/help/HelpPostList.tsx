"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SearchInput } from "@/components/ui/SearchInput";
import { HelpPostCard } from "./HelpPostCard";
import type { HelpPostWithAuthor } from "@/types/cards";
import { LoadMoreSentinel } from "@/components/layout/LoadMoreSentinel";

export function HelpPostList({
  posts,
  currentUserId,
  initialQuery,
  loadMoreParams,
}: {
  posts: HelpPostWithAuthor[];
  currentUserId?: string;
  initialQuery?: string;
  loadMoreParams?: Record<string, string | undefined>;
}) {
  const [query, setQuery] = useState(initialQuery ?? "");
  const queryKey = ["helpPosts", { q: initialQuery ?? "" }];
  const queryClient = useQueryClient();
  const router = useRouter();
  const [cursor, setCursor] = useState<string | null>(
    posts.length === 10 ? posts[posts.length - 1]?.id ?? null : null,
  );
  const [hasMore, setHasMore] = useState(posts.length === 10);
  const [loadingMore, setLoadingMore] = useState(false);
  const { data: helpPosts = [] } = useQuery({
    queryKey,
    queryFn: async () => {
      const search = new URLSearchParams();
      if (initialQuery) search.set("q", initialQuery);
      const response = await fetch(`/api/load-more/help?${search.toString()}`);
      if (!response.ok) throw new Error("Failed to load help posts");
      const data = (await response.json()) as {
        items: HelpPostWithAuthor[];
        hasMore: boolean;
        nextCursor: string | null;
      };
      setCursor(data.nextCursor);
      setHasMore(data.hasMore);
      return data.items;
    },
    initialData: posts,
  });

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const params = new URLSearchParams(window.location.search);
    params.set("q", query);
    router.push(`/help?${params.toString()}`);
  };

  return (
    <div>
      <form onSubmit={handleSearch}>
        <SearchInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by title..."
          className="mb-4"
        />
      </form>
      <div className="grid gap-6 md:grid-cols xl:grid-cols">
        {helpPosts.map((post) => (
          <HelpPostCard
            key={post.id}
            helpPost={post}
            currentUserId={currentUserId}
          />
        ))}
        <LoadMoreSentinel
          disabled={!hasMore || loadingMore}
          onVisible={async () => {
            if (loadingMore || !hasMore) return;
            setLoadingMore(true);
            try {
              const search = new URLSearchParams();
              if (cursor) search.set("cursor", cursor);
              Object.entries(loadMoreParams ?? {}).forEach(([key, value]) => {
                if (value) search.set(key, value);
              });
              const response = await fetch(`/api/load-more/help?${search.toString()}`);
              if (!response.ok) return;
              const data = (await response.json()) as {
                items: HelpPostWithAuthor[];
                hasMore: boolean;
                nextCursor: string | null;
              };
              queryClient.setQueryData<HelpPostWithAuthor[]>(
                queryKey,
                (oldData = []) => [...oldData, ...data.items],
              );
              setCursor(data.nextCursor);
              setHasMore(data.hasMore);
            } finally {
              setLoadingMore(false);
            }
          }}
        />
        {loadingMore ? (
          <div className="py-4 text-center text-sm text-slate-500">
            Loading more...
          </div>
        ) : null}
      </div>
    </div>
  );
}
