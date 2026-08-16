"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SearchInput } from "@/components/ui/SearchInput";
import type { Prisma } from "@prisma/client";
import { SupervisorCard } from "./SupervisorCard";
import { AppendMoreList } from "@/components/layout/AppendMoreList";

type SupervisorWithDetails = Prisma.SupervisorGetPayload<{
  include: {
    author: true;
    recommendations: true;
    votes: true;
    _count: { select: { comments: true; votes: true } };
  };
}>;

export function SupervisorsList({
  supervisors,
  currentUserId,
  initialQuery,
  loadMoreParams,
}: {
  supervisors: SupervisorWithDetails[];
  currentUserId?: string;
  initialQuery?: string;
  loadMoreParams?: Record<string, string | undefined>;
}) {
  const [query, setQuery] = useState(initialQuery ?? "");
  const router = useRouter();

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const params = new URLSearchParams(window.location.search);
    params.set("q", query);
    router.push(`/supervisor?${params.toString()}`);
  };

  return (
    <div className="mb-10">
      <form onSubmit={handleSearch}>
        <SearchInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by professor's name..."
          className="mb-4"
        />
      </form>
      <AppendMoreList
        initialItems={supervisors}
        resource="supervisors"
        params={loadMoreParams}
        renderItem={(s) => (
          <SupervisorCard
            key={(s as SupervisorWithDetails).id}
            supervisor={s as SupervisorWithDetails}
            currentUserId={currentUserId}
          />
        )}
        className="grid gap-6 md:grid-cols"
      />
    </div>
  );
}
