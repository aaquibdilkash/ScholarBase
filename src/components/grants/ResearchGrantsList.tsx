"use client";

import { useMemo } from "react";
import { useIsFetching } from "@tanstack/react-query";
import { useListSearch } from "@/hooks/useListSearch";
import { listEmptyMessage } from "@/lib/list-search";
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
  const { query, setQuery, appliedQuery, isDebouncing, handleSearch, handleClear } = useListSearch(
    "/grants",
    initialQuery,
  );
  // Client-side search: the key tracks the applied term, so a new term fetches
  // its own first page instead of navigating and remounting the page.
  const queryKey = useMemo(
    () => ["grants", appliedQuery] as const,
    [appliedQuery],
  );
  const isFetching = useIsFetching({ queryKey, exact: true }) > 0;
  const isSearching = isDebouncing || isFetching;
  // Only the server-rendered term has data to seed the cache with.
  const isServerQuery = appliedQuery === (initialQuery ?? "");

  return (
    <div>
      <form onSubmit={handleSearch}>
        <SearchInput
          value={query}
          activeQuery={appliedQuery}
          onChange={(e) => setQuery(e.target.value)}
          onClear={handleClear}
          loading={isSearching}
          placeholder="Search by title, amount, or description..."
          className="mb-4"
        />
      </form>
      <CacheBackedList<ResearchGrantWithAuthor>
        queryKey={queryKey}
        initialItems={isServerQuery ? grants : undefined}
        keepPreviousOnKeyChange
        fetchPage={(cursor) => getResearchGrants(appliedQuery, 10, cursor)}
        renderItem={(grant) => (
          <ResearchGrantCard
            key={(grant as ResearchGrantWithAuthor).id}
            grant={grant as ResearchGrantWithAuthor}
            currentUserId={currentUserId}
          />
        )}
        className="grid gap-6 md:grid-cols xl:grid-cols"
        emptyMessage={listEmptyMessage(appliedQuery, "No research grants added yet.")}
      />
    </div>
  );
}
