"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SearchInput } from "@/components/ui/SearchInput";
import { ResearchToolCard } from "./ResearchToolCard";
import type { ResearchToolWithAuthor } from "@/types/cards";
import { AppendMoreList } from "@/components/layout/AppendMoreList";

export function ResearchToolsList({
  tools,
  currentUserId,
  initialQuery,
  loadMoreParams,
}: {
  tools: ResearchToolWithAuthor[];
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
    router.push(`/research-tools?${params.toString()}`);
  };

  return (
    <div>
      <form onSubmit={handleSearch}>
        <SearchInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or description..."
          className="mb-4"
        />
      </form>
      <AppendMoreList
        initialItems={tools}
        resource="research-tools"
        params={loadMoreParams}
        renderItem={(tool) => (
          <ResearchToolCard
            key={(tool as ResearchToolWithAuthor).id}
            tool={tool as ResearchToolWithAuthor}
            currentUserId={currentUserId}
          />
        )}
      />
    </div>
  );
}
