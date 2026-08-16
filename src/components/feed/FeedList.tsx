"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SearchInput } from "@/components/ui/SearchInput";
import type { Prisma } from "@prisma/client";
import { SocialPostCard } from "@/components/feed/SocialPostCard";
import { AppendMoreList } from "@/components/layout/AppendMoreList";

type SocialPostWithDetails = Prisma.SocialPostGetPayload<{
  include: {
    author: {
      select: {
        id: true;
        name: true;
        handle: true;
        avatarUrl: true;
        followers: { select: { followerId: true } };
      };
    };
    votes: true;
    _count: { select: { comments: true; votes: true } };
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
  const router = useRouter();

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

      {posts.length === 0 && (
        <div className="rounded-[24px] border border-dashed border-slate-200 bg-white/80 py-12 text-center">
          <p className="font-medium text-slate-500">
            No posts to show right now.
          </p>
        </div>
      )}

      <AppendMoreList
        initialItems={posts}
        resource="feed"
        params={loadMoreParams}
        renderItem={(post) => (
          <SocialPostCard
            key={(post as SocialPostWithDetails).id}
            post={post as SocialPostWithDetails}
            currentUserId={currentUserId}
          />
        )}
        className="flex flex-col gap-6"
      />
    </div>
  );
}
