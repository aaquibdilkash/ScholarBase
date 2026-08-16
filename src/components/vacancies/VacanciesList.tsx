"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SearchInput } from "@/components/ui/SearchInput";
import { JobVacancy, User } from "@prisma/client";
import { VacancyCard } from "./VacancyCard";
import { AppendMoreList } from "@/components/layout/AppendMoreList";

type VoteShape = {
  userId: string;
  voteType: "UPVOTE" | "DOWNVOTE";
};

type VacancyWithDetails = JobVacancy & {
  author: User & {
    followers?: { followerId: string }[];
  };
  votes: VoteShape[];
  _count: {
    votes: number;
    comments: number;
  };
};

export function VacanciesList({
  vacancies,
  currentUserId,
  initialQuery,
  loadMoreParams,
}: {
  vacancies: VacancyWithDetails[];
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
        initialItems={vacancies}
        resource="vacancies"
        params={loadMoreParams}
        renderItem={(job) => (
          <VacancyCard
            key={(job as VacancyWithDetails).id}
            vacancy={job as VacancyWithDetails}
            currentUserId={currentUserId}
          />
        )}
        className="grid gap-6 md:grid-cols xl:grid-cols"
      />
    </div>
  );
}
