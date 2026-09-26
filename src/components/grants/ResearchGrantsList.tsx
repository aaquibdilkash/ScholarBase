"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SearchInput } from "@/components/ui/SearchInput";
import { ResearchGrantCard } from "./ResearchGrantCard";
import type { ResearchGrantWithAuthor } from "@/types/cards";
import { CacheBackedList } from "@/components/layout/CacheBackedList";
import { getResearchGrants } from "@/app/actions/grants";

export function ResearchGrantsList({
  grants,
  currentUserId,
  initialQuery,
}: {
  grants: ResearchGrantWithAuthor[];
  currentUserId?: string;
  initialQuery?: string;
}) {
  const [query, setQuery] = useState(initialQuery ?? "");
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";
  // Part of the cache key so every cached search variant stays independent.
  const queryKey = useMemo(() => ["grants", q] as const, [q]);


  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const params = new URLSearchParams(window.location.search);
    params.set("q", query);
    router.push(`/grants?${params.toString()}`);
  };

  return (
    <div>
      <form onSubmit={handleSearch}>
        <SearchInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by title, amount, or description..."
          className="mb-4"
        />
      </form>
      <CacheBackedList<ResearchGrantWithAuthor>
        queryKey={queryKey}
        initialItems={grants}
        fetchPage={(cursor) => getResearchGrants(q, 10, cursor)}
        renderItem={(grant) => (
          <ResearchGrantCard
            key={(grant as ResearchGrantWithAuthor).id}
            grant={grant as ResearchGrantWithAuthor}
            currentUserId={currentUserId}
          />
        )}
        className="grid gap-6 md:grid-cols xl:grid-cols"
        emptyMessage="No research grants added yet."
      />
    </div>
  );
}
