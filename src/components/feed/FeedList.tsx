"use client";

import { FilterableOpportunityList } from "@/components/opportunities/FilterableList";
import type { Prisma } from "@prisma/client";
import { SocialPostCard } from "@/components/feed/SocialPostCard";

type SocialPostWithDetails = Prisma.SocialPostGetPayload<{
  include: {
    author: true;
    likes: true;
    _count: { select: { comments: true, likes: true } };
  };
}>;

export function FeedList({
  posts,
  currentUserId,
  initialQuery,
}: {
  posts: SocialPostWithDetails[];
  currentUserId: string;
  initialQuery?: string;
}) {
  return (
    <div className="mb-10">
      <FilterableOpportunityList
        items={posts}
        placeholder="Search posts..."
        filterFn={(post, query) =>
          (post.content ?? "").toLowerCase().includes(query.toLowerCase()) ||
          (post.author?.name ?? "")
            .toLowerCase()
            .includes(query.toLowerCase()) ||
          (post.author?.handle ?? "")
            .toLowerCase()
            .includes(query.toLowerCase())
        }
        renderItem={(post) => (
          <SocialPostCard
            key={post.id}
            post={post}
            isLiked={post.likes?.length > 0}
            currentUserId={currentUserId}
          />
        )}
        initialQuery={initialQuery ?? ""}
        queryParamKey="q"
        basePath="/feed"
        enableClientFiltering={false}
        inputOnly
      />

      <div className="flex flex-col gap-6 mt-6">
        {posts.map((post) => (
          <SocialPostCard
            key={post.id}
            post={post}
            isLiked={post.likes?.length > 0}
            currentUserId={currentUserId}
          />
        ))}
      </div>

      {posts.length === 0 && (
        <div className="rounded-[24px] border border-dashed border-slate-200 bg-white/80 py-12 text-center">
          <p className="font-medium text-slate-500">
            No posts to show right now.
          </p>
        </div>
      )}
    </div>
  );
}
