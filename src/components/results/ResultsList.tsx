"use client";

import { FilterableOpportunityList } from "@/components/opportunities/FilterableList";
import { ResultCard } from "./ResultCard";
import type { ResultWithAuthor } from "@/types/cards";

export function ResultsList({
  results,
  currentUserId,
  initialQuery,
}: {
  results: ResultWithAuthor[];
  currentUserId?: string;
  initialQuery?: string;
}) {
  return (
    <FilterableOpportunityList
      items={results}
      placeholder="Search by title, category, or conducting body..."
      filterFn={(result, query) =>
        result.title.toLowerCase().includes(query.toLowerCase()) ||
        result.description.toLowerCase().includes(query.toLowerCase()) ||
        (result.category?.toLowerCase().includes(query.toLowerCase()) ??
          false) ||
        (result.conductingBody?.toLowerCase().includes(query.toLowerCase()) ??
          false)
      }
      renderItem={(item) => (
        <ResultCard key={item.id} result={item} currentUserId={currentUserId} />
      )}
      initialQuery={initialQuery ?? ""}
      queryParamKey="q"
      basePath="/results"
    />
  );
}
