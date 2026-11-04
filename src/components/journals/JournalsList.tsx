"use client";

import { useMemo } from "react";
import { useIsFetching } from "@tanstack/react-query";
import { useListSearch } from "@/hooks/useListSearch";
import { listEmptyMessage } from "@/lib/list-search";
import { SearchInput } from "@/components/ui/SearchInput";
import { JournalCard } from "./JournalCard";
import type { JournalWithAuthor } from "@/types/cards";
import { CacheBackedList } from "@/components/layout/CacheBackedList";
import { getJournals } from "@/app/actions/journals";

export function JournalsList({
  journals,
  currentUserId,
  initialQuery,
}: {
  journals: JournalWithAuthor[];
  currentUserId?: string;
  initialQuery?: string;
}) {
  const { query, setQuery, appliedQuery, isDebouncing, handleSearch, handleClear } = useListSearch(
    "/journals",
    initialQuery,
  );
  // Client-side search: the key tracks the applied term, so a new term fetches
  // its own first page instead of navigating and remounting the page.
  const queryKey = useMemo(
    () => ["journals", appliedQuery] as const,
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
          placeholder="Search by title or ISSN..."
          className="mb-4"
        />
      </form>
      <CacheBackedList<JournalWithAuthor>
        queryKey={queryKey}
        initialItems={isServerQuery ? journals : undefined}
        keepPreviousOnKeyChange
        fetchPage={(cursor) => getJournals(appliedQuery, 10, cursor)}
        renderItem={(journal) => (
          <JournalCard
            key={journal.id}
            journal={journal}
            currentUserId={currentUserId}
          />
        )}
        className="grid gap-6 md:grid-cols xl:grid-cols"
        emptyMessage={listEmptyMessage(appliedQuery, "No journals posted yet.")}
      />
    </div>
  );
}
