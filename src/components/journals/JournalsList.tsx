"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SearchInput } from "@/components/ui/SearchInput";
import { JournalCard } from "./JournalCard";
import type { JournalWithAuthor } from "@/types/cards";
import { CacheBackedList } from "@/components/layout/CacheBackedList";
import { getJournals } from "@/app/actions/journals";

export function JournalsList({
  journals,
  currentUserId,
  initialQuery,
}: {
  journals: JournalWithAuthor[];
  currentUserId?: string;
  initialQuery?: string;
}) {
  const [query, setQuery] = useState(initialQuery ?? "");
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";
  // Part of the cache key so every cached search variant stays independent.
  const queryKey = useMemo(() => ["journals", q] as const, [q]);


  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const params = new URLSearchParams(window.location.search);
    params.set("q", query);
    router.push(`/journals?${params.toString()}`);
  };

  return (
    <div>
      <form onSubmit={handleSearch}>
        <SearchInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by title or ISSN..."
          className="mb-4"
        />
      </form>
      <CacheBackedList<JournalWithAuthor>
        queryKey={queryKey}
        initialItems={journals}
        fetchPage={(cursor) => getJournals(q, 10, cursor)}
        renderItem={(journal) => (
          <JournalCard
            key={journal.id}
            journal={journal}
            currentUserId={currentUserId}
          />
        )}
        className="grid gap-6 md:grid-cols xl:grid-cols"
        emptyMessage="No journals posted yet."
      />
    </div>
  );
}
