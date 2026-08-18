"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { SearchInput } from "@/components/ui/SearchInput";
import { JournalCard } from "./JournalCard";
import type { JournalWithAuthor } from "@/types/cards";
import { AppendMoreList } from "@/components/layout/AppendMoreList";
import { getJournals } from "@/app/actions/journals";

export function JournalsList({
  journals,
  currentUserId,
  initialQuery,
  loadMoreParams,
}: {
  journals: JournalWithAuthor[];
  currentUserId?: string;
  initialQuery?: string;
  loadMoreParams?: Record<string, string | undefined>;
}) {
  const [query, setQuery] = useState(initialQuery ?? "");
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";

  const { data: journalsData } = useQuery({
    queryKey: ["journals", q],
    queryFn: () => getJournals(q, currentUserId),
    initialData: journals,
  });

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
      <AppendMoreList
        initialItems={journalsData}
        resource="journals"
        params={{ q, ...loadMoreParams }}
        renderItem={(journal) => (
          <JournalCard
            key={(journal as JournalWithAuthor).id}
            journal={journal as JournalWithAuthor}
            currentUserId={currentUserId}
          />
        )}
        className="grid gap-6 md:grid-cols xl:grid-cols"
      />
    </div>
  );
}
