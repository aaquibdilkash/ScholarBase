"use client";

import { useMemo } from "react";
import { useIsFetching } from "@tanstack/react-query";
import { useListSearch } from "@/hooks/useListSearch";
import { listEmptyMessage } from "@/lib/list-search";
import { SearchInput } from "@/components/ui/SearchInput";
import { VacancyCard } from "./VacancyCard";
import type { VacancyWithAuthor } from "@/types/cards";
import { CacheBackedList } from "@/components/layout/CacheBackedList";
import { getVacancies } from "@/app/actions/vacancies";

export function VacanciesList({
  vacancies,
  currentUserId,
  initialQuery,
}: {
  vacancies: VacancyWithAuthor[];
  currentUserId?: string;
  initialQuery?: string;
}) {
  const { query, setQuery, appliedQuery, isDebouncing, handleSearch, handleClear } = useListSearch(
    "/vacancies",
    initialQuery,
  );
  // Client-side search: the key tracks the applied term, so a new term fetches
  // its own first page instead of navigating and remounting the page.
  const queryKey = useMemo(
    () => ["vacancies", appliedQuery] as const,
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
          placeholder="Search by title or institution..."
          className="mb-4"
        />
      </form>
      <CacheBackedList<VacancyWithAuthor>
        queryKey={queryKey}
        initialItems={isServerQuery ? vacancies : undefined}
        keepPreviousOnKeyChange
        fetchPage={(cursor) => getVacancies(appliedQuery, 10, cursor)}
        renderItem={(job) => (
          <VacancyCard
            key={job.id}
            vacancy={job}
            currentUserId={currentUserId}
          />
        )}
        className="grid gap-6 md:grid-cols xl:grid-cols"
        emptyMessage={listEmptyMessage(appliedQuery, "No job vacancies posted yet.")}
      />
    </div>
  );
}
