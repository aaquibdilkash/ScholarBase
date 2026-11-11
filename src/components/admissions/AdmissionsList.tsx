"use client";

import { useState } from "react";
import { SearchInput } from "@/components/ui/SearchInput";
import { useListSearch } from "@/hooks/useListSearch";
import { listEmptyMessage } from "@/lib/list-search";
import { AdmissionCard } from "./AdmissionCard";
import type { AdmissionWithAuthor } from "@/types/cards";
import { AppendMoreList } from "@/components/layout/AppendMoreList";
import { getAdmissions } from "@/app/actions/admissions";

export function AdmissionsList({
  admissions,
  currentUserId,
  initialQuery,
}: {
  admissions: AdmissionWithAuthor[];
  currentUserId?: string;
  initialQuery?: string;
}) {
  const { query, setQuery, appliedQuery, isDebouncing, handleSearch, handleClear } =
    useListSearch("/admissions", initialQuery);
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
          placeholder="Search by university or department..."
          className="mb-4"
        />
      </form>
      <AppendMoreList<AdmissionWithAuthor>
        initialItems={admissions}
        reloadToken={appliedQuery}
        keepItemsWhileReloading
        // Viewer identity is resolved server-side inside the action; the
        // client never sends a userId.
        loadMore={async (cursor) => {
          if (cursor === undefined) setIsLoadingResults(true);
          try {
            return await getAdmissions(appliedQuery, 10, cursor);
          } finally {
            setIsLoadingResults(false);
          }
        }}
        renderItem={(item) => (
          <AdmissionCard
            key={item.id}
            admission={item}
            currentUserId={currentUserId}
          />
        )}
        className="grid gap-6 md:grid-cols xl:grid-cols"
        emptyMessage={listEmptyMessage(appliedQuery, "No admissions posted yet.")}
      />
    </div>
  );
}
