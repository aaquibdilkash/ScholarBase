"use client";

import { FilterableOpportunityList } from "@/components/opportunities/FilterableList";
import { Journal, JournalLike, User } from "@prisma/client";
import { JournalCard } from "./JournalCard";

type JournalWithDetails = Journal & {
  author: User & {
    followers?: { followerId: string }[];
  };
  likes: JournalLike[];
  _count: {
    likes: number;
    comments: number;
  };
};

export function JournalsList({
  journals,
  currentUserId,
  initialQuery,
}: {
  journals: JournalWithDetails[];
  currentUserId?: string;
  initialQuery?: string;
}) {
  return (
    <FilterableOpportunityList
      items={journals}
      placeholder="Search by title or ISSN..."
      filterFn={(journal, query) => {
        const q = query.toLowerCase();
        return (
          (journal.title ?? "").toLowerCase().includes(q) ||
          (journal.issn ?? "").toLowerCase().includes(q) ||
          (journal.author?.name ?? "").toLowerCase().includes(q)
        );
      }}
      renderItem={(journal) => (
        <JournalCard
          key={journal.id}
          journal={{ ...journal, isLiked: (journal.likes?.length ?? 0) > 0 }}
          currentUserId={currentUserId}
        />
      )}
      initialQuery={initialQuery ?? ""}
      queryParamKey="q"
      basePath="/journals"
    />
  );
}
