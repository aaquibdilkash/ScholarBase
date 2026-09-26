"use client";

import { useState } from "react";
import { SearchInput } from "@/components/ui/SearchInput";
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
  const [query, setQuery] = useState(initialQuery ?? "");
  // Search runs on submit, so keep the applied term separate from the input
  // value. Driving pagination from the raw input would refetch every keystroke.
  const [appliedQuery, setAppliedQuery] = useState(initialQuery ?? "");

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setAppliedQuery(query);
  };

  return (
    <div>
      <form onSubmit={handleSearch}>
        <SearchInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by university or department..."
          className="mb-4"
        />
      </form>
      <AppendMoreList<AdmissionWithAuthor>
        initialItems={admissions}
        // Search is client-side (no navigation), so re-fetch page 1 per term.
        reloadToken={appliedQuery}
        loadMore={(cursor) => getAdmissions(appliedQuery, 10, cursor)}
        renderItem={(item) => (
          <AdmissionCard
            key={item.id}
            admission={item}
            currentUserId={currentUserId}
          />
        )}
        className="grid gap-6 md:grid-cols xl:grid-cols"
        emptyMessage="No PhD admissions posted yet."
      />
    </div>
  );
}
