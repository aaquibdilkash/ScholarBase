"use client";

import { FilterableOpportunityList } from "@/components/opportunities/FilterableList";
import { HelpPost, User } from "@prisma/client";
import { HelpPostCard } from "./HelpPostCard";

type HelpPostWithAuthor = HelpPost & {
  author: User;
  likes: { userId: string }[];
  _count: { likes: number; comments: number };
};

export function HelpPostList({ posts }: { posts: HelpPostWithAuthor[] }) {
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
          helpPost={{ ...post, isLiked: (post.likes?.length ?? 0) > 0 }}
        />
      )}
    />
  );
}
