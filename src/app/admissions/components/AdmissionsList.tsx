"use client";

import { FilterableOpportunityList } from "@/components/opportunities/FilterableList";
import { PhdAdmission, PhdAdmissionLike, User } from "@prisma/client";
import { AdmissionCard } from "./AdmissionCard";

type AdmissionWithDetails = PhdAdmission & {
  author: User;
  likes: PhdAdmissionLike[];
  _count: {
    likes: number;
    comments: number;
  };
};

export function AdmissionsList({
  admissions,
}: {
  admissions: AdmissionWithDetails[];
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
          admission={{ ...item, isLiked: item.likes.length > 0 }}
        />
      )}
    />
  );
}
