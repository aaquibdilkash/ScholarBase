
"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SearchInput } from "@/components/ui/SearchInput";
import type { ArticleWithAuthor } from "@/types/cards";
import { ArticleCard } from "@/components/blog/ArticleCard";
import { AppendMoreList } from "@/components/layout/AppendMoreList";
import { getArticles } from "@/app/actions/blog";

export function ArticleList({
  articles,
  currentUserId,
  initialQuery,
}: {
  articles: ArticleWithAuthor[];
  currentUserId?: string;
  initialQuery?: string;
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
        loadMore={(cursor) => getArticles(query, currentUserId, 10, cursor)}
        renderItem={(article) => (
          <ArticleCard
            key={(article as ArticleWithAuthor).id}
            article={article as ArticleWithAuthor}
            currentUserId={currentUserId}
          />
        )}
        className="grid gap-6 md:grid-cols xl:grid-cols"
        emptyMessage="No blog posts published yet."
      />
    </div>
  );
}
