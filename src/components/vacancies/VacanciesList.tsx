"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SearchInput } from "@/components/ui/SearchInput";
import { VacancyCard } from "./VacancyCard";
import type { VacancyWithAuthor } from "@/types/cards";
import { CacheBackedList } from "@/components/layout/CacheBackedList";
import { getVacancies } from "@/app/actions/vacancies";

export function VacanciesList({
  vacancies,
  currentUserId,
  initialQuery,
}: {
  vacancies: VacancyWithAuthor[];
  currentUserId?: string;
  initialQuery?: string;
}) {
  const [query, setQuery] = useState(initialQuery ?? "");
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";
  // Part of the cache key so every cached search variant stays independent.
  const queryKey = useMemo(() => ["vacancies", q] as const, [q]);


  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const params = new URLSearchParams(window.location.search);
    params.set("q", query);
    router.push(`/vacancies?${params.toString()}`);
  };

  return (
    <div>
      <form onSubmit={handleSearch}>
        <SearchInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by title or institution..."
          className="mb-4"
        />
      </form>
      <CacheBackedList<VacancyWithAuthor>
        queryKey={queryKey}
        initialItems={vacancies}
        fetchPage={(cursor) => getVacancies(q, 10, cursor)}
        renderItem={(job) => (
          <VacancyCard
            key={job.id}
            vacancy={job}
            currentUserId={currentUserId}
          />
        )}
        className="grid gap-6 md:grid-cols xl:grid-cols"
        emptyMessage="No job vacancies posted yet."
      />
    </div>
  );
}
