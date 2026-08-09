"use client";

import { FilterableOpportunityList } from "@/components/opportunities/FilterableList";
import { ScholarCard } from "./ScholarCard";
import type { Scholar } from "@/types/scholar";

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