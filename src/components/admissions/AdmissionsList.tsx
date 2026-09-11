"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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

  const { data: admissionsData, refetch } = useQuery({
    queryKey: ["admissions", query],
    queryFn: () => getAdmissions(query),
    initialData: admissions,
  });

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    refetch();
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
      <AppendMoreList
        initialItems={admissionsData}
        loadMore={(cursor) => getAdmissions(query, currentUserId, 10, cursor)}
        renderItem={(item) => (
          <AdmissionCard
            key={(item as AdmissionWithAuthor).id}
            admission={item as AdmissionWithAuthor}
            currentUserId={currentUserId}
          />
        )}
        className="grid gap-6 md:grid-cols xl:grid-cols"
        emptyMessage="No PhD admissions posted yet."
      />
    </div>
  );
}
