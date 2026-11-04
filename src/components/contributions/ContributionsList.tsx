"use client";

import { useMemo } from "react";
import { useIsFetching } from "@tanstack/react-query";
import { useListSearch } from "@/hooks/useListSearch";
import { listEmptyMessage } from "@/lib/list-search";
import { SearchInput } from "@/components/ui/SearchInput";
import { ContributionCard } from "./ContributionCard";
import type { ContributionWithAuthor } from "@/types/cards";
import { CacheBackedList } from "@/components/layout/CacheBackedList";
import { getContributions } from "@/app/actions/contributions";

export function ContributionsList({
  contributions,
  currentUserId,
  initialQuery,
}: {
  contributions: ContributionWithAuthor[];
  currentUserId?: string;
  initialQuery?: string;
}) {
  const { query, setQuery, appliedQuery, isDebouncing, handleSearch, handleClear } = useListSearch(
    "/contributions",
    initialQuery,
  );
  // Client-side search: the key tracks the applied term, so a new term fetches
  // its own first page instead of navigating and remounting the page.
  const queryKey = useMemo(
    () => ["contributions", appliedQuery] as const,
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
          placeholder="Search by title or message..."
          className="mb-4"
        />
      </form>
      <CacheBackedList<ContributionWithAuthor>
        queryKey={queryKey}
        initialItems={isServerQuery ? contributions : undefined}
        keepPreviousOnKeyChange
        fetchPage={(cursor) => getContributions(appliedQuery, 10, cursor)}
        renderItem={(contribution) => (
          <ContributionCard
            key={(contribution as ContributionWithAuthor).id}
            contribution={contribution as ContributionWithAuthor}
            currentUserId={currentUserId}
          />
        )}
        className="grid gap-6 md:grid-cols xl:grid-cols"
        emptyMessage={listEmptyMessage(appliedQuery, "No contributions made yet.")}
      />
    </div>
  );
}
