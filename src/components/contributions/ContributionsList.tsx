"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { buildSearchHref } from "@/lib/list-search";
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
    // Empty input clears `?q` so the page falls back to the unfiltered list.
    router.push(buildSearchHref("/contributions", window.location.search, query));
  };

  return (
    <div>
      <form onSubmit={handleSearch}>
        <SearchInput
          value={query}
          activeQuery={initialQuery}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by title or message..."
          className="mb-4"
        />
      </form>
      <CacheBackedList<ContributionWithAuthor>
        queryKey={queryKey}
        initialItems={contributions}
        fetchPage={(cursor) => getContributions(q, 10, cursor)}
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
