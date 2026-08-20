"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SearchInput } from "@/components/ui/SearchInput";
import type { Prisma } from "@prisma/client";
import { SocialPostCard } from "@/components/feed/SocialPostCard";
import { LoadMoreSentinel } from "@/components/layout/LoadMoreSentinel";

type SocialPostWithDetails = Prisma.SocialPostGetPayload<{
  select: {
    id: true;
    content: true;
    imageUrl: true;
    createdAt: true;
    updatedAt: true;
    editedAt: true;
    author: {
      select: {
        id: true;
        name: true;
        handle: true;
        avatarUrl: true;
        followers: { select: { followerId: true } };
      };
    };
    totalVotes: true;
    totalComments: true;
    votes: { select: { voteType: true } };
  };
}>;

export function FeedList({
  posts,
  currentUserId,
  initialQuery,
  loadMoreParams,
}: {
  posts: SocialPostWithDetails[];
  currentUserId?: string;
  initialQuery?: string;
  loadMoreParams?: Record<string, string | undefined>;
}) {
  const [query, setQuery] = useState(initialQuery ?? "");
  const queryKey = ["feed", { q: initialQuery ?? "", tab: loadMoreParams?.tab ?? "" }];
  const queryClient = useQueryClient();
  const router = useRouter();
  const [cursor, setCursor] = useState<string | null>(
    posts.length === 10 ? posts[posts.length - 1]?.id ?? null : null,
  );
  const [hasMore, setHasMore] = useState(posts.length === 10);
  const [loadingMore, setLoadingMore] = useState(false);
  const { data: feedPosts = [] } = useQuery({
    queryKey,
    queryFn: async () => {
      const search = new URLSearchParams();
      if (initialQuery) search.set("q", initialQuery);
      if (loadMoreParams?.tab) search.set("tab", loadMoreParams.tab);
      const response = await fetch(`/api/load-more/feed?${search.toString()}`);
      if (!response.ok) throw new Error("Failed to load feed");
      const data = (await response.json()) as {
        items: SocialPostWithDetails[];
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
    router.push(`/feed?${params.toString()}`);
  };

  return (
    <div className="mb-10">
      <form onSubmit={handleSearch}>
        <SearchInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search posts..."
          className="mb-4"
        />
      </form>

      {feedPosts.length === 0 && (
        <div className="rounded-[24px] border border-dashed border-slate-200 bg-white/80 py-12 text-center">
          <p className="font-medium text-slate-500">
            No posts to show right now.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-6">
        {feedPosts.map((post) => (
          <SocialPostCard
            key={post.id}
            post={post}
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
              const response = await fetch(`/api/load-more/feed?${search.toString()}`);
              if (!response.ok) return;
              const data = (await response.json()) as {
                items: SocialPostWithDetails[];
                hasMore: boolean;
                nextCursor: string | null;
              };
              queryClient.setQueryData<SocialPostWithDetails[]>(
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
