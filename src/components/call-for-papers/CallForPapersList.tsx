"use client";

import { useMemo } from "react";
import { useIsFetching } from "@tanstack/react-query";
import { useListSearch } from "@/hooks/useListSearch";
import { listEmptyMessage } from "@/lib/list-search";
import { SearchInput } from "@/components/ui/SearchInput";
import { CallForPaperCard } from "./CallForPaperCard";
import type { CallForPaperWithAuthor } from "@/types/cards";
import { CacheBackedList } from "@/components/layout/CacheBackedList";
import { getCallForPapers } from "@/app/actions/call-for-papers";

export function CallForPapersList({
  callForPapers,
  currentUserId,
  initialQuery,
}: {
  callForPapers: CallForPaperWithAuthor[];
  currentUserId?: string;
  initialQuery?: string;
}) {
  const { query, setQuery, appliedQuery, isDebouncing, handleSearch, handleClear } = useListSearch(
    "/call-for-papers",
    initialQuery,
  );
  // Client-side search: the key tracks the applied term, so a new term fetches
  // its own first page instead of navigating and remounting the page.
  const queryKey = useMemo(
    () => ["callForPapers", appliedQuery] as const,
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
          placeholder="Search by title or location..."
          className="mb-4"
        />
      </form>
      <CacheBackedList<CallForPaperWithAuthor>
        queryKey={queryKey}
        initialItems={isServerQuery ? callForPapers : undefined}
        keepPreviousOnKeyChange
        fetchPage={(cursor) => getCallForPapers(appliedQuery, 10, cursor)}
        renderItem={(event) => (
          <CallForPaperCard
            key={event.id}
            event={event}
            currentUserId={currentUserId}
          />
        )}
        className="grid gap-6 md:grid-cols xl:grid-cols"
        emptyMessage={listEmptyMessage(appliedQuery, "No call for papers posted yet.")}
      />
    </div>
  );
}
