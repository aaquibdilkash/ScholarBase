"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SearchInput } from "@/components/ui/SearchInput";
import type { Prisma } from "@prisma/client";
import { SocialPostCard } from "@/components/feed/SocialPostCard";
import { LoadMoreSentinel } from "@/components/layout/LoadMoreSentinel";
import { getFeed } from "@/app/actions/feed";

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
  const queryKey = useMemo(() => ["feed", { q: initialQuery ?? "", tab: loadMoreParams?.tab ?? "" }], [initialQuery, loadMoreParams?.tab]);
  const queryClient = useQueryClient();
  const router = useRouter();
  const [hasMore, setHasMore] = useState(posts.length === 10);
  const [loadingMore, setLoadingMore] = useState(false);
  const { data: feedPosts = [] } = useQuery({
    queryKey,
    queryFn: async () => {
      const tab = loadMoreParams?.tab;
      const items = await getFeed(currentUserId, tab, initialQuery, 10);
      const data = items.map((p) => p as SocialPostWithDetails);
      return data;
    },
    initialData: posts,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (posts.length === 10) {
      setHasMore(true);
    }
  }, [posts.length]);

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const params = new URLSearchParams(window.location.search);
    params.set("q", query);
    router.push(`/feed?${params.toString()}`);
  };

  const loadMorePosts = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const lastItemId = feedPosts.length > 0 ? feedPosts[feedPosts.length - 1].id : undefined;
      const tab = loadMoreParams?.tab;
      const newItems = await getFeed(currentUserId, tab, initialQuery, 10, lastItemId);
      
      if (newItems.length === 10) {
        setHasMore(true);
      } else {
        setHasMore(false);
      }
      
      queryClient.setQueryData<SocialPostWithDetails[]>(
        queryKey,
        (oldData = []) => [...oldData, ...(newItems as SocialPostWithDetails[])],
      );
    } catch (error) {
      console.error("Failed to load more posts:", error);
    } finally {
      setLoadingMore(false);
    }
  }, [feedPosts, currentUserId, initialQuery, hasMore, loadingMore, queryClient, loadMoreParams, queryKey]);

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
          onVisible={loadMorePosts}
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