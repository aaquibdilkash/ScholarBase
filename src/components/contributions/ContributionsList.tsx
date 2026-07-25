"use client";

import { FilterableOpportunityList } from "@/components/opportunities/FilterableList";
import { Contribution, User } from "@prisma/client";
import { ContributionCard } from "./ContributionCard";

type ContributionWithAuthor = Contribution & {
  author: User & {
    followers?: { followerId: string }[];
  };
  votes: { userId: string }[];
  _count: { votes: number; comments: number };
};

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
