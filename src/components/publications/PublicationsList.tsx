"use client";

import { FilterableOpportunityList } from "@/components/opportunities/FilterableList";
import { Publication, User } from "@prisma/client";
import { PublicationCard } from "./PublicationCard";

type PublicationWithDetails = Publication & {
  author: User & {
    followers?: { followerId: string }[];
  };
  votes: { userId: string }[];
  _count: {
    votes: number;
    comments: number;
  };
};

export function PublicationsList({
  publications,
  currentUserId,
  initialQuery,
}: {
  publications: PublicationWithDetails[];
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
