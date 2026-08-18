"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { SearchInput } from "@/components/ui/SearchInput";
import { PublicationCard } from "./PublicationCard";
import type { PublicationWithAuthor } from "@/types/cards";
import { AppendMoreList } from "@/components/layout/AppendMoreList";
import { getPublications } from "@/app/actions/publications";

export function PublicationsList({
  publications,
  currentUserId,
  initialQuery,
  loadMoreParams,
}: {
  publications: PublicationWithAuthor[];
  currentUserId?: string;
  initialQuery?: string;
  loadMoreParams?: Record<string, string | undefined>;
}) {
  const [query, setQuery] = useState(initialQuery ?? "");
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";

  const { data: publicationsData } = useQuery({
    queryKey: ["publications", q],
    queryFn: () => getPublications(q, currentUserId),
    initialData: publications,
  });

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const params = new URLSearchParams(window.location.search);
    params.set("q", query);
    router.push(`/publications?${params.toString()}`);
  };

  return (
    <div>
      <form onSubmit={handleSearch}>
        <SearchInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by title, author, keyword, or domain..."
          className="mb-4"
        />
      </form>
      <AppendMoreList
        initialItems={publicationsData}
        resource="publications"
        params={{ q, ...loadMoreParams }}
        renderItem={(pub) => (
          <PublicationCard
            key={(pub as PublicationWithAuthor).id}
            publication={pub as PublicationWithAuthor}
            currentUserId={currentUserId}
          />
        )}
      />
    </div>
  );
}
