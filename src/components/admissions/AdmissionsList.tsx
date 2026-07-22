"use client";

import { FilterableOpportunityList } from "@/components/opportunities/FilterableList";
import { PhdAdmission, User } from "@prisma/client";
import { AdmissionCard } from "./AdmissionCard";

type AdmissionWithDetails = PhdAdmission & {
  author: User;
  votes: { userId: string }[];
  _count: {
    votes: number;
    comments: number;
  };
};

export function AdmissionsList({
  admissions,
  currentUserId,
  initialQuery,
}: {
  admissions: AdmissionWithDetails[];
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
