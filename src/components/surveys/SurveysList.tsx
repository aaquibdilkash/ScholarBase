"use client";

import { FilterableOpportunityList } from "@/components/opportunities/FilterableList";
import { SurveyCard } from "./SurveyCard";
import type { SurveyWithAuthor } from "@/types/cards";

export function SurveysList({
  surveys,
  currentUserId,
  initialQuery,
}: {
  surveys: SurveyWithAuthor[];
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
