"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { SearchInput } from "@/components/ui/SearchInput";
import type { Prisma } from "@prisma/client";
import { SupervisorCard } from "./SupervisorCard";
import { AppendMoreList } from "@/components/layout/AppendMoreList";
import { getSupervisors } from "@/app/actions/supervisors";

type SupervisorWithDetails = Prisma.SupervisorGetPayload<{
  select: {
    id: true;
    name: true;
    university: true;
    department: true;
    createdAt: true;
    author: {
      select: {
        id: true;
        name: true;
        handle: true;
        avatarUrl: true;
        followers: { select: { followerId: true } } | false;
      };
    };
    totalVotes: true;
    totalComments: true;
    votes: { select: { voteType: true } } | false;
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
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";

  const { data: supervisorsData } = useQuery({
    queryKey: ["supervisors", q],
    queryFn: () => getSupervisors(q, currentUserId),
    initialData: supervisors,
  });

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
        initialItems={supervisorsData}
        resource="supervisors"
        params={{ q, ...loadMoreParams }}
        renderItem={(s) => (
          <SupervisorCard
            key={(s as SupervisorWithDetails).id}
            supervisor={s as SupervisorWithDetails}
            currentUserId={currentUserId}
          />
        )}
        className="grid gap-6 md:grid-cols xl:grid-cols"
      />
    </div>
  );
}
