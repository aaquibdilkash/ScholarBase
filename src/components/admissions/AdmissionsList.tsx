"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SearchInput } from "@/components/ui/SearchInput";
import { buildSearchHref } from "@/lib/list-search";
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
  const router = useRouter();

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Empty input clears `?q` so the page falls back to the unfiltered list.
    router.push(buildSearchHref("/admissions", window.location.search, query));
  };

  return (
    <div>
      <form onSubmit={handleSearch}>
        <SearchInput
          value={query}
          activeQuery={initialQuery}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by university or department..."
          className="mb-4"
        />
      </form>
      <AppendMoreList<AdmissionWithAuthor>
        initialItems={admissions}
        // Viewer identity is resolved server-side inside the action; the
        // client never sends a userId.
        loadMore={(cursor) => getAdmissions(initialQuery, 10, cursor)}
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
