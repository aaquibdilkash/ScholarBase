
"use client";

import { useState } from "react";
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
  // Search runs on submit, so keep the applied term separate from the input
  // value. Driving pagination from the raw input would refetch every keystroke.
  const [appliedQuery, setAppliedQuery] = useState(initialQuery ?? "");

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setAppliedQuery(query);
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
      <AppendMoreList<ArticleWithAuthor>
        initialItems={articles}
        // Search is client-side (no navigation), so re-fetch page 1 per term.
        reloadToken={appliedQuery}
        // Viewer identity is resolved server-side inside the action; the
        // client never sends a userId.
        loadMore={(cursor) => getArticles(appliedQuery, 10, cursor)}
        renderItem={(article) => (
          <ArticleCard
            key={article.id}
            article={article}
            currentUserId={currentUserId}
          />
        )}
        className="grid gap-6 md:grid-cols xl:grid-cols"
        emptyMessage="No blog posts published yet."
      />
    </div>
  );
}
