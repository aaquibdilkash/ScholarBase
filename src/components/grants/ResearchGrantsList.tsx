"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { buildSearchHref } from "@/lib/list-search";
import { SearchInput } from "@/components/ui/SearchInput";
import { ResearchGrantCard } from "./ResearchGrantCard";
import type { ResearchGrantWithAuthor } from "@/types/cards";
import { CacheBackedList } from "@/components/layout/CacheBackedList";
import { getResearchGrants } from "@/app/actions/grants";

export function ResearchGrantsList({
  grants,
  currentUserId,
  initialQuery,
}: {
  grants: ResearchGrantWithAuthor[];
  currentUserId?: string;
  initialQuery?: string;
}) {
  const [query, setQuery] = useState(initialQuery ?? "");
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";
  // Part of the cache key so every cached search variant stays independent.
  const queryKey = useMemo(() => ["grants", q] as const, [q]);


  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Empty input clears `?q` so the page falls back to the unfiltered list.
    router.push(buildSearchHref("/grants", window.location.search, query));
  };

  return (
    <div>
      <form onSubmit={handleSearch}>
        <SearchInput
          value={query}
          activeQuery={initialQuery}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by title, amount, or description..."
          className="mb-4"
        />
      </form>
      <CacheBackedList<ResearchGrantWithAuthor>
        queryKey={queryKey}
        initialItems={grants}
        fetchPage={(cursor) => getResearchGrants(q, 10, cursor)}
        renderItem={(grant) => (
          <ResearchGrantCard
            key={(grant as ResearchGrantWithAuthor).id}
            grant={grant as ResearchGrantWithAuthor}
            currentUserId={currentUserId}
          />
        )}
        className="grid gap-6 md:grid-cols xl:grid-cols"
        emptyMessage="No research grants added yet."
      />
    </div>
  );
}
