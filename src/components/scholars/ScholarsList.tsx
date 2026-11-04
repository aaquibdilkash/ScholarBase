"use client";

import { useState } from "react";
import { useListSearch } from "@/hooks/useListSearch";
import { listEmptyMessage } from "@/lib/list-search";
import { SearchInput } from "@/components/ui/SearchInput";
import { ScholarCard } from "./ScholarCard";
import type { Scholar } from "@/types/scholar";
import { AppendMoreList } from "@/components/layout/AppendMoreList";
import { getScholars } from "@/app/actions/scholars";

export function ScholarsList({
  scholars,
  currentUserId,
  initialQuery,
  loadMoreParams,
}: {
  scholars: Scholar[];
  currentUserId?: string;
  initialQuery?: string;
  loadMoreParams?: Record<string, string | undefined>;
}) {
  const { query, setQuery, appliedQuery, isDebouncing, handleSearch, handleClear } =
    useListSearch("/scholars", initialQuery);
  // `AppendMoreList` owns its own fetches (no React Query), so the first-page
  // request reports back here to drive the search bar's spinner.
  const [isLoadingResults, setIsLoadingResults] = useState(false);
  const isSearching = isDebouncing || isLoadingResults;

  return (
    <div>
      <form onSubmit={handleSearch}>
        <SearchInput
          value={query}
          activeQuery={appliedQuery}
          onChange={(e) => setQuery(e.target.value)}
          onClear={handleClear}
          loading={isSearching}
          placeholder="Search by name, handle, or bio"
          className="mb-4"
        />
      </form>
      <AppendMoreList
        initialItems={scholars}
        reloadToken={appliedQuery}
        keepItemsWhileReloading
        loadMore={async (cursor) => {
          if (cursor === undefined) setIsLoadingResults(true);
          try {
            // Viewer identity is resolved server-side inside the action; the
            // client never sends a userId.
            return await getScholars(
              appliedQuery,
              loadMoreParams?.sort === "reputation" ? "reputation" : "latest",
              10,
              cursor,
            );
          } finally {
            setIsLoadingResults(false);
          }
        }}
        renderItem={(item) => (
          <ScholarCard
            key={(item as Scholar).id}
            scholar={item as Scholar}
            currentUserId={currentUserId}
          />
        )}
        className="grid gap-6 md:grid-cols xl:grid-cols"
        emptyMessage={listEmptyMessage(appliedQuery, "No scholars found.")}
      />
    </div>
  );
}
