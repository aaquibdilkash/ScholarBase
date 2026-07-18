"use client";

import { FilterableOpportunityList } from "@/components/opportunities/FilterableList";
import type { Prisma } from "@prisma/client";
import { SupervisorCard } from "./SupervisorCard";

type SupervisorWithDetails = Prisma.SupervisorGetPayload<{
  include: {
    author: true;
    recommendations: true;
    likes: true;
    _count: { select: { comments: true; likes: true } };
  };
}>;

export function SupervisorsList({
  supervisors,
  currentUserId,
  initialQuery,
}: {
  supervisors: SupervisorWithDetails[];
  currentUserId?: string;
  initialQuery?: string;
}) {
  return (
    <div className="mb-10">
      <FilterableOpportunityList
        items={supervisors}
        placeholder="Search by professor's name..."
        filterFn={(supervisor, query) =>
          (supervisor.name ?? "").toLowerCase().includes(query.toLowerCase())
        }
        renderItem={() => null}
        initialQuery={initialQuery ?? ""}
        queryParamKey="q"
        basePath="/supervisor"
        enableClientFiltering={false}
        inputOnly
      />

      {supervisors.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2">
          {supervisors.map((s) => (
            <SupervisorCard
              key={s.id}
              supervisor={s}
              currentUserId={currentUserId}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
