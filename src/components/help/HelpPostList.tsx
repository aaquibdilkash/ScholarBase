"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
    const params = new URLSearchParams(window.location.search);
    params.set("q", query);
    router.push(`/help?${params.toString()}`);
  };

  return (
    <div>
      <form onSubmit={handleSearch}>
        <SearchInput
          value={query}
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
