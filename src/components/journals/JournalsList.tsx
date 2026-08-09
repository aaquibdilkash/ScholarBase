"use client";

import { FilterableOpportunityList } from "@/components/opportunities/FilterableList";
import { JournalCard } from "./JournalCard";
import type { JournalWithAuthor } from "@/types/cards";

export function JournalsList({
  journals,
  currentUserId,
  initialQuery,
}: {
  journals: JournalWithAuthor[];
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
          journal={journal}
          currentUserId={currentUserId}
        />
      )}
      initialQuery={initialQuery ?? ""}
      queryParamKey="q"
      basePath="/journals"
    />
  );
}
