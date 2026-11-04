"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { buildSearchHref } from "@/lib/list-search";
import { SearchInput } from "@/components/ui/SearchInput";
import { HelpPostCard } from "./HelpPostCard";
import type { HelpPostWithAuthor } from "@/types/cards";
import { CacheBackedList } from "@/components/layout/CacheBackedList";
import { getHelpPosts } from "@/app/actions/help";

export function HelpPostList({
  posts,
  currentUserId,
  initialQuery,
}: {
  posts: HelpPostWithAuthor[];
  currentUserId?: string;
  initialQuery?: string;
}) {
  const [query, setQuery] = useState(initialQuery ?? "");
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";
  // Part of the cache key so every cached search variant stays independent.
  const queryKey = useMemo(() => ["helpPosts", q] as const, [q]);


  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Empty input clears `?q` so the page falls back to the unfiltered list.
    router.push(buildSearchHref("/help", window.location.search, query));
  };

  return (
    <div>
      <form onSubmit={handleSearch}>
        <SearchInput
          value={query}
          activeQuery={initialQuery}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by title..."
          className="mb-4"
        />
      </form>
      <CacheBackedList<HelpPostWithAuthor>
        queryKey={queryKey}
        initialItems={posts}
        fetchPage={(cursor) => getHelpPosts(query, 10, cursor)}
        renderItem={(post) => (
          <HelpPostCard
            key={(post as HelpPostWithAuthor).id}
            helpPost={post as HelpPostWithAuthor}
            currentUserId={currentUserId}
          />
        )}
        className="grid gap-6 md:grid-cols xl:grid-cols"
        emptyMessage="No help posts yet."
      />
    </div>
  );
}
