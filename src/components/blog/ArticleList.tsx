
"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SearchInput } from "@/components/ui/SearchInput";
import type { Prisma } from "@prisma/client";
import { ArticleCard } from "@/components/blog/ArticleCard";
import { AppendMoreList } from "@/components/layout/AppendMoreList";
import { getArticles } from "@/app/actions/blog";

type ArticleWithDetails = Prisma.ArticleGetPayload<{
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
    votes: { select: { userId: true; voteType: true } };
    _count: { select: { votes: true; comments: true } };
  };
}>;

export function ArticleList({
  articles,
  currentUserId,
  initialQuery,
  loadMoreParams,
}: {
  articles: ArticleWithDetails[];
  currentUserId?: string;
  initialQuery?: string;
  loadMoreParams?: Record<string, string | undefined>;
}) {
  const [query, setQuery] = useState(initialQuery ?? "");
  const { data: articlesData, refetch } = useQuery({
    queryKey: ["articles", query],
    queryFn: () => getArticles(query),
    initialData: articles,
  });

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    refetch();
  };

  return (
    <div className="mb-10">
      <form onSubmit={handleSearch}>
        <SearchInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search articles..."
          className="mb-4"
        />
      </form>
      <AppendMoreList
        initialItems={articlesData}
        resource="blog"
        params={{ q: query, ...loadMoreParams }}
        renderItem={(article) => (
          <ArticleCard
            key={(article as ArticleWithDetails).id}
            article={article as ArticleWithDetails}
            currentUserId={currentUserId}
          />
        )}
      />
    </div>
  );
}
