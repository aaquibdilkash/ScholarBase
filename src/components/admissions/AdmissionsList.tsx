"use client";

import { FilterableOpportunityList } from "@/components/opportunities/FilterableList";
import { AdmissionCard } from "./AdmissionCard";
import type { AdmissionWithAuthor } from "@/types/cards";

export function AdmissionsList({
  admissions,
  currentUserId,
  initialQuery,
}: {
  admissions: AdmissionWithAuthor[];
  currentUserId?: string;
  initialQuery?: string;
}) {
  return (
    <FilterableOpportunityList
      items={admissions}
      placeholder="Search by university or department..."
      filterFn={(admission, query) =>
        admission.university.toLowerCase().includes(query.toLowerCase()) ||
        admission.department.toLowerCase().includes(query.toLowerCase())
      }
      renderItem={(item) => (
        <AdmissionCard
          key={item.id}
          admission={item}
          currentUserId={currentUserId}
        />
      )}
      initialQuery={initialQuery ?? ""}
      queryParamKey="q"
      basePath="/admissions"
    />
  );
}
