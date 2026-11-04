"use client";

import { useMemo } from "react";
import { useIsFetching } from "@tanstack/react-query";
import { useListSearch } from "@/hooks/useListSearch";
import { listEmptyMessage } from "@/lib/list-search";
import { SearchInput } from "@/components/ui/SearchInput";
import { ResearchToolCard } from "./ResearchToolCard";
import type { ResearchToolWithAuthor } from "@/types/cards";
import { CacheBackedList } from "@/components/layout/CacheBackedList";
import { getResearchTools } from "@/app/actions/researchTools";

export function ResearchToolsList({
  tools,
  currentUserId,
  initialQuery,
}: {
  tools: ResearchToolWithAuthor[];
  currentUserId?: string;
  initialQuery?: string;
}) {
  const { query, setQuery, appliedQuery, isDebouncing, handleSearch, handleClear } = useListSearch(
    "/research-tools",
    initialQuery,
  );
  // Client-side search: the key tracks the applied term, so a new term fetches
  // its own first page instead of navigating and remounting the page.
  const queryKey = useMemo(
    () => ["researchTools", appliedQuery] as const,
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
          placeholder="Search by name or description..."
          className="mb-4"
        />
      </form>
      <CacheBackedList<ResearchToolWithAuthor>
        queryKey={queryKey}
        initialItems={isServerQuery ? tools : undefined}
        keepPreviousOnKeyChange
        fetchPage={(cursor) => getResearchTools(appliedQuery, 10, cursor)}
        renderItem={(tool) => (
          <ResearchToolCard
            key={(tool as ResearchToolWithAuthor).id}
            tool={tool as ResearchToolWithAuthor}
            currentUserId={currentUserId}
          />
        )}
        className="grid gap-6 md:grid-cols xl:grid-cols"
        emptyMessage={listEmptyMessage(appliedQuery, "No research tools posted yet.")}
      />
    </div>
  );
}
