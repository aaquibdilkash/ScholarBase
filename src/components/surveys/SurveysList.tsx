"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { SearchInput } from "@/components/ui/SearchInput";
import { SurveyCard } from "./SurveyCard";
import type { SurveyWithAuthor } from "@/types/cards";
import { AppendMoreList } from "@/components/layout/AppendMoreList";
import { getSurveys } from "@/app/actions/surveys";

export function SurveysList({
  surveys,
  currentUserId,
  initialQuery,
  loadMoreParams,
}: {
  surveys: SurveyWithAuthor[];
  currentUserId?: string;
  initialQuery?: string;
  loadMoreParams?: Record<string, string | undefined>;
}) {
  const [query, setQuery] = useState(initialQuery ?? "");
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";

  const { data: surveysData } = useQuery({
    queryKey: ["surveys", q],
    queryFn: () => getSurveys(q, currentUserId),
    initialData: surveys,
  });

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
      <AppendMoreList
        initialItems={surveysData}
        resource="surveys"
        params={{ q, ...loadMoreParams }}
        renderItem={(item) => (
          <SurveyCard
            key={(item as SurveyWithAuthor).id}
            survey={item as SurveyWithAuthor}
            currentUserId={currentUserId}
          />
        )}
        className="grid gap-6 md:grid-cols xl:grid-cols"
      />
    </div>
  );
}
