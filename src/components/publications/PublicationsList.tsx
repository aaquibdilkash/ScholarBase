"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SearchInput } from "@/components/ui/SearchInput";
import { PublicationCard } from "./PublicationCard";
import type { PublicationWithAuthor } from "@/types/cards";
import { CacheBackedList } from "@/components/layout/CacheBackedList";
import { getPublications } from "@/app/actions/publications";

export function PublicationsList({
  publications,
  currentUserId,
  initialQuery,
}: {
  publications: PublicationWithAuthor[];
  currentUserId?: string;
  initialQuery?: string;
}) {
  const [query, setQuery] = useState(initialQuery ?? "");
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";
  // Part of the cache key so every cached search variant stays independent.
  const queryKey = useMemo(() => ["publications", q] as const, [q]);


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
      <CacheBackedList<PublicationWithAuthor>
        queryKey={queryKey}
        initialItems={publications}
        fetchPage={(cursor) => getPublications(q, currentUserId, 10, cursor)}
        renderItem={(pub) => (
          <PublicationCard
            key={(pub as PublicationWithAuthor).id}
            publication={pub as PublicationWithAuthor}
            currentUserId={currentUserId}
          />
        )}
        className="grid gap-6 md:grid-cols xl:grid-cols"
        emptyMessage="No publications added yet."
      />
    </div>
  );
}
