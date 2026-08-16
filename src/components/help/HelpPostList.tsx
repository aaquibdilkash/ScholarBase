"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SearchInput } from "@/components/ui/SearchInput";
import { HelpPostCard } from "./HelpPostCard";
import type { HelpPostWithAuthor } from "@/types/cards";
import { AppendMoreList } from "@/components/layout/AppendMoreList";

export function HelpPostList({
  posts,
  currentUserId,
  initialQuery,
  loadMoreParams,
}: {
  posts: HelpPostWithAuthor[];
  currentUserId?: string;
  initialQuery?: string;
  loadMoreParams?: Record<string, string | undefined>;
}) {
  const [query, setQuery] = useState(initialQuery ?? "");
  const router = useRouter();

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
      <AppendMoreList
        initialItems={posts}
        resource="help"
        params={loadMoreParams}
        renderItem={(post) => (
          <HelpPostCard
            key={(post as HelpPostWithAuthor).id}
            helpPost={post as HelpPostWithAuthor}
            currentUserId={currentUserId}
          />
        )}
        className="grid gap-6 md:grid-cols xl:grid-cols"
      />
    </div>
  );
}
