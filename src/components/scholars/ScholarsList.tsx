"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SearchInput } from "@/components/ui/SearchInput";
import { ScholarCard } from "./ScholarCard";
import type { Scholar } from "@/types/scholar";
import { AppendMoreList } from "@/components/layout/AppendMoreList";

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
  const [query, setQuery] = useState(initialQuery ?? "");
  const router = useRouter();

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const params = new URLSearchParams(window.location.search);
    params.set("q", query);
    router.push(`/scholars?${params.toString()}`);
  };

  return (
    <div>
      <form onSubmit={handleSearch}>
        <SearchInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, handle, or bio"
          className="mb-4"
        />
      </form>
      <AppendMoreList
        initialItems={scholars}
        resource="scholars"
        params={loadMoreParams}
        renderItem={(item) => (
          <ScholarCard
            key={(item as Scholar).id}
            scholar={item as Scholar}
            currentUserId={currentUserId}
          />
        )}
        className="grid gap-6 md:grid-cols xl:grid-cols"
      />
    </div>
  );
}
