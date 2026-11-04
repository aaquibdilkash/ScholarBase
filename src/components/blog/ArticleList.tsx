"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SearchInput } from "@/components/ui/SearchInput";
import { buildSearchHref } from "@/lib/list-search";
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
  const router = useRouter();

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Empty input clears `?q` so the page falls back to the unfiltered list.
    router.push(buildSearchHref("/blog", window.location.search, query));
  };

  return (
    <div className="mb-10">
      <form onSubmit={handleSearch}>
        <SearchInput
          value={query}
          activeQuery={initialQuery}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search articles..."
          className="mb-4"
        />
      </form>
      <AppendMoreList<ArticleWithAuthor>
        initialItems={articles}
        // Viewer identity is resolved server-side inside the action; the
        // client never sends a userId.
        loadMore={(cursor) => getArticles(initialQuery, 10, cursor)}
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
