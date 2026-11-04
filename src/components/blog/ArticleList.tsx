"use client";

import { useState } from "react";
import { SearchInput } from "@/components/ui/SearchInput";
import { useListSearch } from "@/hooks/useListSearch";
import { listEmptyMessage } from "@/lib/list-search";
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
  const { query, setQuery, appliedQuery, isDebouncing, handleSearch, handleClear } =
    useListSearch("/blog", initialQuery);
  // `AppendMoreList` owns its own fetches (no React Query), so the first-page
  // request reports back here to drive the search bar's spinner.
  const [isLoadingResults, setIsLoadingResults] = useState(false);
  const isSearching = isDebouncing || isLoadingResults;

  return (
    <div className="mb-10">
      <form onSubmit={handleSearch}>
        <SearchInput
          value={query}
          activeQuery={appliedQuery}
          onChange={(e) => setQuery(e.target.value)}
          onClear={handleClear}
          loading={isSearching}
          placeholder="Search articles..."
          className="mb-4"
        />
      </form>
      <AppendMoreList<ArticleWithAuthor>
        initialItems={articles}
        reloadToken={appliedQuery}
        keepItemsWhileReloading
        // Viewer identity is resolved server-side inside the action; the
        // client never sends a userId.
        loadMore={async (cursor) => {
          if (cursor === undefined) setIsLoadingResults(true);
          try {
            return await getArticles(appliedQuery, 10, cursor);
          } finally {
            setIsLoadingResults(false);
          }
        }}
        renderItem={(article) => (
          <ArticleCard
            key={article.id}
            article={article}
            currentUserId={currentUserId}
          />
        )}
        className="grid gap-6 md:grid-cols xl:grid-cols"
        emptyMessage={listEmptyMessage(appliedQuery, "No blog posts published yet.")}
      />
    </div>
  );
}
