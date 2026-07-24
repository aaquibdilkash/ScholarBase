"use client";

import { FilterableOpportunityList } from "@/components/opportunities/FilterableList";
import { JobVacancy, User } from "@prisma/client";
import { VacancyCard } from "./VacancyCard";

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
}: {
  vacancies: VacancyWithDetails[];
  currentUserId?: string;
  initialQuery?: string;
}) {
  return (
    <FilterableOpportunityList
      items={vacancies}
      placeholder="Search by title or institution..."
      filterFn={(vacancy, query) =>
        vacancy.title.toLowerCase().includes(query.toLowerCase()) ||
        vacancy.institution.toLowerCase().includes(query.toLowerCase())
      }
      renderItem={(job) => (
        <VacancyCard key={job.id} vacancy={job} currentUserId={currentUserId} />
      )}
      initialQuery={initialQuery ?? ""}
      queryParamKey="q"
      basePath="/vacancies"
    />
  );
}
