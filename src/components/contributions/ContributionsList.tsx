"use client";

import { FilterableOpportunityList } from "@/components/opportunities/FilterableList";
import { ContributionCard } from "./ContributionCard";
import type { ContributionWithAuthor } from "@/types/cards";

export function ContributionsList({
  contributions,
  currentUserId,
  initialQuery,
}: {
  contributions: ContributionWithAuthor[];
  currentUserId?: string;
  initialQuery?: string;
}) {
  return (
    <FilterableOpportunityList
      items={contributions}
      placeholder="Search by title or message..."
      filterFn={(contribution, query) => {
        const q = query.toLowerCase();
        return (
          (contribution.title ?? "").toLowerCase().includes(q) ||
          (contribution.message ?? "").toLowerCase().includes(q)
        );
      }}
      renderItem={(contribution) => (
        <ContributionCard
          key={contribution.id}
          contribution={contribution}
          currentUserId={currentUserId}
        />
      )}
      initialQuery={initialQuery ?? ""}
      queryParamKey="q"
      basePath="/contributions"
    />
  );
}
