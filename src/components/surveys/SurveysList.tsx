"use client";

import { FilterableOpportunityList } from "@/components/opportunities/FilterableList";
import { ResearchSurvey, User } from "@prisma/client";
import { SurveyCard } from "./SurveyCard";

type SurveyWithDetails = ResearchSurvey & {
  author: User;
  votes: any[];
  _count: {
    votes: number;
    comments: number;
    responses: number;
  };
};

export function SurveysList({
  surveys,
  currentUserId,
  initialQuery,
}: {
  surveys: SurveyWithDetails[];
  currentUserId?: string;
  initialQuery?: string;
}) {
  return (
    <FilterableOpportunityList
      items={surveys}
      placeholder="Search surveys by title or description..."
      filterFn={(survey, query) =>
        survey.title.toLowerCase().includes(query.toLowerCase()) ||
        (survey.description?.toLowerCase().includes(query.toLowerCase()) ??
          false)
      }
      renderItem={(item) => (
        <SurveyCard key={item.id} survey={item} currentUserId={currentUserId} />
      )}
      initialQuery={initialQuery ?? ""}
      queryParamKey="q"
      basePath="/surveys"
    />
  );
}
