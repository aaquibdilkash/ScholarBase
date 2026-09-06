"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
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
        emptyState={
          <div className="flex flex-col items-center rounded-[28px] border border-dashed border-slate-200 bg-white/80 px-6 py-16 text-center shadow-sm">
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-slate-50">
              <Plus className="w-8 h-8 text-slate-400" />
            </div>
            <p className="mb-6 text-lg font-medium text-slate-600">
              Couldn&apos;t find the supervisor you&apos;re looking for?
            </p>
            <Link
              href="/supervisor/add"
              className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-6 py-3 font-semibold text-slate-900 shadow-sm transition-all hover:bg-slate-50 hover:border-slate-300"
            >
              Add them to <BrandMark className="font-semibold" />
            </Link>
          </div>
        }
      />
    </div>
  );
}
