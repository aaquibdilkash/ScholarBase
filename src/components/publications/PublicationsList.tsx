"use client";

import { FilterableOpportunityList } from "@/components/opportunities/FilterableList";
import { PublicationCard } from "./PublicationCard";
import type { PublicationWithAuthor } from "@/types/cards";

export function PublicationsList({
  publications,
  currentUserId,
  initialQuery,
}: {
  publications: PublicationWithAuthor[];
  currentUserId?: string;
  initialQuery?: string;
}) {
  return (
    <FilterableOpportunityList
      items={publications}
      placeholder="Search by title, author, keyword, or domain..."
      filterFn={(pub, query) => {
        const q = query.toLowerCase();
        return (
          (pub.title ?? "").toLowerCase().includes(q) ||
          (pub.authors ?? "").toLowerCase().includes(q) ||
          (pub.keywords ?? "").toLowerCase().includes(q) ||
          (pub.domain ?? "").toLowerCase().includes(q) ||
          (pub.journalOrConference ?? "").toLowerCase().includes(q) ||
          (pub.abstract ?? "").toLowerCase().includes(q) ||
          (pub.author?.name ?? "").toLowerCase().includes(q)
        );
      }}
      renderItem={(pub) => (
        <PublicationCard
          key={pub.id}
          publication={pub}
          currentUserId={currentUserId}
        />
      )}
      initialQuery={initialQuery ?? ""}
      queryParamKey="q"
      basePath="/publications"
    />
  );
}
