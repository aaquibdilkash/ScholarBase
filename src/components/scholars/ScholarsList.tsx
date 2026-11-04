"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { buildSearchHref } from "@/lib/list-search";
import { SearchInput } from "@/components/ui/SearchInput";
import { ScholarCard } from "./ScholarCard";
import type { Scholar } from "@/types/scholar";
import { AppendMoreList } from "@/components/layout/AppendMoreList";
import { getScholars } from "@/app/actions/scholars";

export function ScholarsList({
  scholars,
  currentUserId,
  initialQuery,
  loadMoreParams,
}: {
  scholars: Scholar[];
  currentUserId?: string;
  initialQuery?: string;
  loadMoreParams?: Record<string, string | undefined>;
}) {
  const [query, setQuery] = useState(initialQuery ?? "");
  const router = useRouter();

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Empty input clears `?q` so the page falls back to the unfiltered list.
    router.push(buildSearchHref("/scholars", window.location.search, query));
  };

  return (
    <div>
      <form onSubmit={handleSearch}>
        <SearchInput
          value={query}
          activeQuery={initialQuery}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, handle, or bio"
          className="mb-4"
        />
      </form>
      <AppendMoreList
        initialItems={scholars}
        loadMore={(cursor) =>
          // Viewer identity is resolved server-side inside the action; the
          // client never sends a userId.
          getScholars(
            initialQuery,
            loadMoreParams?.sort === "reputation" ? "reputation" : "latest",
            10,
            cursor,
          )
        }
        renderItem={(item) => (
          <ScholarCard
            key={(item as Scholar).id}
            scholar={item as Scholar}
            currentUserId={currentUserId}
          />
        )}
        className="grid gap-6 md:grid-cols xl:grid-cols"
        emptyMessage="No scholars found."
      />
    </div>
  );
}
