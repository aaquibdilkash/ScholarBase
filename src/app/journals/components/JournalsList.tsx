"use client";

import { FilterableOpportunityList } from "@/components/opportunities/FilterableList";
import { Journal, JournalLike, User } from "@prisma/client";
import { JournalCard } from "./JournalCard";

type JournalWithDetails = Journal & {
  author: User;
  likes: JournalLike[];
  _count: {
    likes: number;
    comments: number;
  };
};

export function JournalsList({ journals }: { journals: JournalWithDetails[] }) {
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
        />
      )}
    />
  );
}
