"use client";

import { FilterableOpportunityList } from "@/components/opportunities/FilterableList";
import { ResearchGrantCard } from "./ResearchGrantCard";
import type { ResearchGrantWithAuthor } from "@/types/cards";

export function ResearchGrantsList({
  grants,
  currentUserId,
  initialQuery,
}: {
  grants: ResearchGrantWithAuthor[];
  currentUserId?: string;
  initialQuery?: string;
}) {
  return (
    <FilterableOpportunityList
      items={grants}
      placeholder="Search by title, amount, or description..."
      filterFn={(grant, query) => {
        const q = query.toLowerCase();
        return (
          grant.title.toLowerCase().includes(q) ||
          (grant.amount?.toLowerCase().includes(q) ?? false) ||
          grant.description.toLowerCase().includes(q) ||
          (grant.author.name?.toLowerCase().includes(q) ?? false)
        );
      }}
      renderItem={(grant) => <ResearchGrantCard key={grant.id} grant={grant} currentUserId={currentUserId} />}
      initialQuery={initialQuery ?? ""}
      queryParamKey="q"
      basePath="/grants"
    />
  );
}
