"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SearchInput } from "@/components/ui/SearchInput";
import { ContributionCard } from "./ContributionCard";
import type { ContributionWithAuthor } from "@/types/cards";
import { CacheBackedList } from "@/components/layout/CacheBackedList";
import { getContributions } from "@/app/actions/contributions";

export function ContributionsList({
  contributions,
  currentUserId,
  initialQuery,
}: {
  contributions: ContributionWithAuthor[];
  currentUserId?: string;
  initialQuery?: string;
}) {
  const [query, setQuery] = useState(initialQuery ?? "");
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";
  // Part of the cache key so every cached search variant stays independent.
  const queryKey = useMemo(() => ["contributions", q] as const, [q]);


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
      <CacheBackedList<ContributionWithAuthor>
        queryKey={queryKey}
        initialItems={contributions}
        fetchPage={(cursor) => getContributions(q, currentUserId, 10, cursor)}
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
