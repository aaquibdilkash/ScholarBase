"use client";

import { useMemo } from "react";
import { useIsFetching } from "@tanstack/react-query";
import { useListSearch } from "@/hooks/useListSearch";
import { listEmptyMessage } from "@/lib/list-search";
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
  const { query, setQuery, appliedQuery, isDebouncing, handleSearch, handleClear } = useListSearch(
    "/publications",
    initialQuery,
  );
  // Client-side search: the key tracks the applied term, so a new term fetches
  // its own first page instead of navigating and remounting the page.
  const queryKey = useMemo(
    () => ["publications", appliedQuery] as const,
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
          placeholder="Search by title, author, keyword, or domain..."
          className="mb-4"
        />
      </form>
      <CacheBackedList<PublicationWithAuthor>
        queryKey={queryKey}
        initialItems={isServerQuery ? publications : undefined}
        keepPreviousOnKeyChange
        fetchPage={(cursor) => getPublications(appliedQuery, 10, cursor)}
        renderItem={(pub) => (
          <PublicationCard
            key={(pub as PublicationWithAuthor).id}
            publication={pub as PublicationWithAuthor}
            currentUserId={currentUserId}
          />
        )}
        className="grid gap-6 md:grid-cols xl:grid-cols"
        emptyMessage={listEmptyMessage(appliedQuery, "No publications added yet.")}
      />
    </div>
  );
}
