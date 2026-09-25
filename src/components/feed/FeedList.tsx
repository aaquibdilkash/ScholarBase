"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { SearchInput } from "@/components/ui/SearchInput";
import type { Prisma } from "@prisma/client";
import { SocialPostCard } from "@/components/feed/SocialPostCard";
import { CacheBackedList } from "@/components/layout/CacheBackedList";
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
        avatarUrl: true, institutionVerifiedAt: true;
        followers: { select: { followerId: true } };
      };
    };
    totalVotes: true;
    totalBookmarks: true;
    totalComments: true;
    votes: { select: { voteType: true } };
    bookmarks: { select: { id: true } };
  };
}>;

export function FeedList({
  posts,
  currentUserId,
  initialQuery,
  tab,
  pageSize = 10,
}: {
  posts: SocialPostWithDetails[];
  currentUserId?: string;
  initialQuery?: string;
  /** Active feed tab ("trending", "following", ...). Part of the query key. */
  tab?: string;
  /** Page size, shared with the server so `hasMore` stays in sync. */
  pageSize?: number;
}) {
  const [query, setQuery] = useState(initialQuery ?? "");
  // Keep the same key shape the cache writers in CreateSocialPostForm /
  // SocialPostCard / CommentSection target via `{ queryKey: ["feed"] }`.
  const queryKey = useMemo(
    () => ["feed", { q: initialQuery ?? "", tab: tab ?? "" }] as const,
    [initialQuery, tab],
  );
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

      <CacheBackedList<SocialPostWithDetails>
        queryKey={queryKey}
        initialItems={posts}
        chunkSize={pageSize}
        fetchPage={(cursor) =>
          getFeed(currentUserId, tab, initialQuery, pageSize, cursor)
        }
        renderItem={(post, index) => (
          <SocialPostCard
            key={post.id}
            post={post}
            currentUserId={currentUserId}
            priority={index === 0}
          />
        )}
        className="flex flex-col gap-6"
        emptyState={
          <div className="rounded-[24px] border border-dashed border-slate-200 bg-white/80 py-12 text-center">
            <p className="font-medium text-slate-500">
              No posts to show right now.
            </p>
          </div>
        }
        onLoadError={(error) => {
          console.error("Failed to load more posts:", error);
        }}
      />
    </div>
  );
}
