"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { buildSearchHref } from "@/lib/list-search";
import { SearchInput } from "@/components/ui/SearchInput";
import { ResearchToolCard } from "./ResearchToolCard";
import type { ResearchToolWithAuthor } from "@/types/cards";
import { CacheBackedList } from "@/components/layout/CacheBackedList";
import { getResearchTools } from "@/app/actions/researchTools";

export function ResearchToolsList({
  tools,
  currentUserId,
  initialQuery,
}: {
  tools: ResearchToolWithAuthor[];
  currentUserId?: string;
  initialQuery?: string;
}) {
  const [query, setQuery] = useState(initialQuery ?? "");
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";
  // Part of the cache key so every cached search variant stays independent.
  const queryKey = useMemo(() => ["researchTools", q] as const, [q]);


  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Empty input clears `?q` so the page falls back to the unfiltered list.
    router.push(buildSearchHref("/research-tools", window.location.search, query));
  };

  return (
    <div>
      <form onSubmit={handleSearch}>
        <SearchInput
          value={query}
          activeQuery={initialQuery}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or description..."
          className="mb-4"
        />
      </form>
      <CacheBackedList<ResearchToolWithAuthor>
        queryKey={queryKey}
        initialItems={tools}
        fetchPage={(cursor) => getResearchTools(q, 10, cursor)}
        renderItem={(tool) => (
          <ResearchToolCard
            key={(tool as ResearchToolWithAuthor).id}
            tool={tool as ResearchToolWithAuthor}
            currentUserId={currentUserId}
          />
        )}
        className="grid gap-6 md:grid-cols xl:grid-cols"
        emptyMessage="No research tools posted yet."
      />
    </div>
  );
}
