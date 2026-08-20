"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { SearchInput } from "@/components/ui/SearchInput";
import { VacancyCard } from "./VacancyCard";
import type { VacancyWithAuthor } from "@/types/cards";
import { AppendMoreList } from "@/components/layout/AppendMoreList";
import { getVacancies } from "@/app/actions/vacancies";

export function VacanciesList({
  vacancies,
  currentUserId,
  initialQuery,
  loadMoreParams,
}: {
  vacancies: VacancyWithAuthor[];
  currentUserId?: string;
  initialQuery?: string;
  loadMoreParams?: Record<string, string | undefined>;
}) {
  const [query, setQuery] = useState(initialQuery ?? "");
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";

  const { data: vacancyData } = useQuery({
    queryKey: ['vacancies', q],
    queryFn: () => getVacancies(q, currentUserId),
    initialData: vacancies,
  });

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
      <AppendMoreList
        initialItems={vacancyData}
        resource="vacancies"
        params={loadMoreParams}
        renderItem={(job) => (
          <VacancyCard
            key={(job as VacancyWithAuthor).id}
            vacancy={job as VacancyWithAuthor}
            currentUserId={currentUserId}
          />
        )}
        className="grid gap-6 md:grid-cols xl:grid-cols"
      />
    </div>
  );
}
