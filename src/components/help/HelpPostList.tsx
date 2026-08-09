"use client";

import { FilterableOpportunityList } from "@/components/opportunities/FilterableList";
import { HelpPostCard } from "./HelpPostCard";
import type { HelpPostWithAuthor } from "@/types/cards";

export function HelpPostList({
  posts,
  currentUserId,
  initialQuery,
}: {
  posts: HelpPostWithAuthor[];
  currentUserId?: string;
  initialQuery?: string;
}) {
  return (
    <FilterableOpportunityList
      items={posts}
      placeholder="Search by title..."
      filterFn={(post, query) =>
        post.title.toLowerCase().includes(query.toLowerCase())
      }
      renderItem={(post) => (
        <HelpPostCard
          key={post.id}
          helpPost={post}
          currentUserId={currentUserId}
        />
      )}
      initialQuery={initialQuery ?? ""}
      queryParamKey="q"
      basePath="/help"
    />
  );
}
