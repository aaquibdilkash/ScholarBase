"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SearchInput } from "@/components/ui/SearchInput";
import { ResultCard } from "./ResultCard";
import type { ResultWithAuthor } from "@/types/cards";
import { CacheBackedList } from "@/components/layout/CacheBackedList";
import { getResults } from "@/app/actions/results";

export function ResultsList({
  results,
  currentUserId,
  initialQuery,
}: {
  results: ResultWithAuthor[];
  currentUserId?: string;
  initialQuery?: string;
}) {
  const [query, setQuery] = useState(initialQuery ?? "");
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";
  // Part of the cache key so every cached search variant stays independent.
  const queryKey = useMemo(() => ["results", q] as const, [q]);


  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const params = new URLSearchParams(window.location.search);
    params.set("q", query);
    router.push(`/results?${params.toString()}`);
  };

  return (
    <div>
      <form onSubmit={handleSearch}>
        <SearchInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by title, category, or conducting body..."
          className="mb-4"
        />
      </form>
      <CacheBackedList<ResultWithAuthor>
        queryKey={queryKey}
        initialItems={results}
        fetchPage={(cursor) => getResults(q, 10, cursor)}
        renderItem={(item) => (
          <ResultCard
            key={item.id}
            result={item}
            currentUserId={currentUserId}
          />
        )}
        className="grid gap-6 md:grid-cols xl:grid-cols"
        emptyMessage="No results posted yet."
      />
    </div>
  );
}
