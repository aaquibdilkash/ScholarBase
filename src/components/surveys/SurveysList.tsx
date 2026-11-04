"use client";

import { useMemo } from "react";
import { useIsFetching } from "@tanstack/react-query";
import { useListSearch } from "@/hooks/useListSearch";
import { listEmptyMessage } from "@/lib/list-search";
import { SearchInput } from "@/components/ui/SearchInput";
import { SurveyCard } from "./SurveyCard";
import type { SurveyWithAuthor } from "@/types/cards";
import { CacheBackedList } from "@/components/layout/CacheBackedList";
import { getSurveys } from "@/app/actions/surveys";

export function SurveysList({
  surveys,
  currentUserId,
  initialQuery,
}: {
  surveys: SurveyWithAuthor[];
  currentUserId?: string;
  initialQuery?: string;
}) {
  const { query, setQuery, appliedQuery, isDebouncing, handleSearch, handleClear } = useListSearch(
    "/surveys",
    initialQuery,
  );
  // Client-side search: the key tracks the applied term, so a new term fetches
  // its own first page instead of navigating and remounting the page.
  const queryKey = useMemo(
    () => ["surveys", appliedQuery] as const,
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
          placeholder="Search surveys by title or description..."
          className="mb-4"
        />
      </form>
      <CacheBackedList<SurveyWithAuthor>
        queryKey={queryKey}
        initialItems={isServerQuery ? surveys : undefined}
        keepPreviousOnKeyChange
        fetchPage={(cursor) => getSurveys(appliedQuery, 10, cursor)}
        renderItem={(item) => (
          <SurveyCard
            key={(item as SurveyWithAuthor).id}
            survey={item as SurveyWithAuthor}
            currentUserId={currentUserId}
          />
        )}
        className="grid gap-6 md:grid-cols xl:grid-cols"
        emptyMessage={listEmptyMessage(appliedQuery, "No research surveys created yet.")}
      />
    </div>
  );
}
