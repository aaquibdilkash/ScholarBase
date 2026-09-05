"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { SearchInput } from "@/components/ui/SearchInput";
import { ContributionCard } from "./ContributionCard";
import type { ContributionWithAuthor } from "@/types/cards";
import { AppendMoreList } from "@/components/layout/AppendMoreList";
import { getContributions } from "@/app/actions/contributions";

export function ContributionsList({
  contributions,
  currentUserId,
  initialQuery,
  loadMoreParams,
}: {
  contributions: ContributionWithAuthor[];
  currentUserId?: string;
  initialQuery?: string;
  loadMoreParams?: Record<string, string | undefined>;
}) {
  const [query, setQuery] = useState(initialQuery ?? "");
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";

  const { data: contributionsData } = useQuery({
    queryKey: ["contributions", q],
    queryFn: () => getContributions(q, currentUserId),
    initialData: contributions,
  });

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const params = new URLSearchParams(window.location.search);
    params.set("q", query);
    router.push(`/contributions?${params.toString()}`);
  };

  return (
    <div>
      <form onSubmit={handleSearch}>
        <SearchInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by title or message..."
          className="mb-4"
        />
      </form>
      <AppendMoreList
        initialItems={contributionsData}
        resource="contributions"
        params={{ q, ...loadMoreParams }}
        renderItem={(contribution) => (
          <ContributionCard
            key={(contribution as ContributionWithAuthor).id}
            contribution={contribution as ContributionWithAuthor}
            currentUserId={currentUserId}
          />
        )}
        className="grid gap-6 md:grid-cols xl:grid-cols"
        emptyMessage="No contributions made yet."
      />
    </div>
  );
}
