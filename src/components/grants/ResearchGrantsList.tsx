"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { SearchInput } from "@/components/ui/SearchInput";
import { ResearchGrantCard } from "./ResearchGrantCard";
import type { ResearchGrantWithAuthor } from "@/types/cards";
import { AppendMoreList } from "@/components/layout/AppendMoreList";
import { getResearchGrants } from "@/app/actions/grants";

export function ResearchGrantsList({
  grants,
  currentUserId,
  initialQuery,
  loadMoreParams,
}: {
  grants: ResearchGrantWithAuthor[];
  currentUserId?: string;
  initialQuery?: string;
  loadMoreParams?: Record<string, string | undefined>;
}) {
  const [query, setQuery] = useState(initialQuery ?? "");
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";

  const { data: grantsData } = useQuery({
    queryKey: ["grants", q],
    queryFn: () => getResearchGrants(q, currentUserId),
    initialData: grants,
  });

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const params = new URLSearchParams(window.location.search);
    params.set("q", query);
    router.push(`/grants?${params.toString()}`);
  };

  return (
    <div>
      <form onSubmit={handleSearch}>
        <SearchInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by title, amount, or description..."
          className="mb-4"
        />
      </form>
      <AppendMoreList
        initialItems={grantsData}
        resource="grants"
        params={{ q, ...loadMoreParams }}
        renderItem={(grant) => (
          <ResearchGrantCard
            key={(grant as ResearchGrantWithAuthor).id}
            grant={grant as ResearchGrantWithAuthor}
            currentUserId={currentUserId}
          />
        )}
      />
    </div>
  );
}
