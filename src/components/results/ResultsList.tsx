"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { SearchInput } from "@/components/ui/SearchInput";
import { ResultCard } from "./ResultCard";
import type { ResultWithAuthor } from "@/types/cards";
import { AppendMoreList } from "@/components/layout/AppendMoreList";
import { getResults } from "@/app/actions/results";

export function ResultsList({
  results,
  currentUserId,
  initialQuery,
  loadMoreParams,
}: {
  results: ResultWithAuthor[];
  currentUserId?: string;
  initialQuery?: string;
  loadMoreParams?: Record<string, string | undefined>;
}) {
  const [query, setQuery] = useState(initialQuery ?? "");
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";

  const { data: resultsData } = useQuery({
    queryKey: ["results", q],
    queryFn: () => getResults(q, currentUserId),
    initialData: results,
  });

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
      <AppendMoreList
        initialItems={resultsData}
        resource="results"
        params={{ q, ...loadMoreParams }}
        renderItem={(item) => (
          <ResultCard
            key={(item as ResultWithAuthor).id}
            result={item as ResultWithAuthor}
            currentUserId={currentUserId}
          />
        )}
        className="grid gap-6 md:grid-cols xl:grid-cols"
        emptyMessage="No results posted yet."
      />
    </div>
  );
}
