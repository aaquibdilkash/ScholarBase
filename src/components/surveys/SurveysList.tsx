"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SearchInput } from "@/components/ui/SearchInput";
import { SurveyCard } from "./SurveyCard";
import type { SurveyWithAuthor } from "@/types/cards";
import { CacheBackedList } from "@/components/layout/CacheBackedList";
import { getSurveys } from "@/app/actions/surveys";

export function SurveysList({
  surveys,
  currentUserId,
  initialQuery,
}: {
  surveys: SurveyWithAuthor[];
  currentUserId?: string;
  initialQuery?: string;
}) {
  const [query, setQuery] = useState(initialQuery ?? "");
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";
  // Part of the cache key so every cached search variant stays independent.
  const queryKey = useMemo(() => ["surveys", q] as const, [q]);


  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const params = new URLSearchParams(window.location.search);
    params.set("q", query);
    router.push(`/surveys?${params.toString()}`);
  };

  return (
    <div>
      <form onSubmit={handleSearch}>
        <SearchInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search surveys by title or description..."
          className="mb-4"
        />
      </form>
      <CacheBackedList<SurveyWithAuthor>
        queryKey={queryKey}
        initialItems={surveys}
        fetchPage={(cursor) => getSurveys(q, currentUserId, 10, cursor)}
        renderItem={(item) => (
          <SurveyCard
            key={(item as SurveyWithAuthor).id}
            survey={item as SurveyWithAuthor}
            currentUserId={currentUserId}
          />
        )}
        className="grid gap-6 md:grid-cols xl:grid-cols"
        emptyMessage="No research surveys created yet."
      />
    </div>
  );
}
