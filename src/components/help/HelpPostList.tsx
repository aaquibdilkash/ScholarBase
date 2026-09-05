"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { SearchInput } from "@/components/ui/SearchInput";
import { HelpPostCard } from "./HelpPostCard";
import type { HelpPostWithAuthor } from "@/types/cards";
import { AppendMoreList } from "@/components/layout/AppendMoreList";
import { getHelpPosts } from "@/app/actions/help";

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
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";

  const { data: helpPostsData } = useQuery({
    queryKey: ["helpPosts", q],
    queryFn: () => getHelpPosts(q, currentUserId),
    initialData: posts,
  });

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
        initialItems={helpPostsData}
        resource="help"
        params={{ q: query, ...loadMoreParams }}
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
