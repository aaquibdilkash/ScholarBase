"use client";

import { FilterableOpportunityList } from "@/components/opportunities/FilterableList";
import { ScholarCard } from "./ScholarCard";

type Scholar = {
  id: string;
  name: string | null;
  handle: string | null;
  avatarUrl: string | null;
  bio: string | null;
  reputation: number;
  createdAt: Date;
  followers?: { followerId: string }[];
  _count: { followers: number; following: number };
};

export function ScholarsList({
  scholars,
  currentUserId,
  initialQuery,
}: {
  scholars: Scholar[];
  currentUserId?: string;
  initialQuery?: string;
}) {
  return (
    <FilterableOpportunityList
      items={scholars}
      placeholder="Search by name, handle, or bio"
      filterFn={(scholar, query) =>
        (scholar.name?.toLowerCase().includes(query.toLowerCase()) ||
        scholar.handle?.toLowerCase().includes(query.toLowerCase()) ||
        scholar.bio?.toLowerCase().includes(query.toLowerCase())) ?? false
      }
      renderItem={(item) => (
        <ScholarCard
          key={item.id}
          scholar={item}
          currentUserId={currentUserId}
        />
      )}
      initialQuery={initialQuery ?? ""}
      queryParamKey="q"
      basePath="/scholars"
    />
  );
}