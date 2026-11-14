"use client";

import { useMemo } from "react";
import { useIsFetching } from "@tanstack/react-query";
import { useListSearch } from "@/hooks/useListSearch";
import { NO_SEARCH_MATCH } from "@/lib/list-search";
import { Plus } from "lucide-react";
import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { SearchInput } from "@/components/ui/SearchInput";
import { SupervisorCard } from "./SupervisorCard";
import { CacheBackedList } from "@/components/layout/CacheBackedList";
import { getSupervisors } from "@/app/actions/supervisors";

/**
 * Row shape, derived from the loader so the list and the data layer can never
 * drift. The loader resolves viewer state server-side and returns `votes` /
 * `bookmarks` as real arrays (never `false`), plus the zero-compute
 * `recommendationCount` / `ratingSum` scalars.
 */
type SupervisorWithDetails = Awaited<
  ReturnType<typeof getSupervisors>
>[number];

export function SupervisorsList({
  supervisors,
  currentUserId,
  initialQuery,
}: {
  supervisors: SupervisorWithDetails[];
  currentUserId?: string;
  initialQuery?: string;
}) {
  const { query, setQuery, appliedQuery, isDebouncing, handleSearch, handleClear } =
    useListSearch("/supervisor", initialQuery);
  // Client-side search: the key tracks the applied term, so a new term fetches
  // its own first page instead of navigating and remounting the page.
  const queryKey = useMemo(
    () => ["supervisors", appliedQuery] as const,
    [appliedQuery],
  );
  const isFetching = useIsFetching({ queryKey, exact: true }) > 0;
  const isSearching = isDebouncing || isFetching;
  // Only the server-rendered term has data to seed the cache with.
  const isServerQuery = appliedQuery === (initialQuery ?? "");
  const searching = appliedQuery.trim().length > 0;

  return (
    <div className="mb-10">
      <form onSubmit={handleSearch}>
        <SearchInput
          value={query}
          activeQuery={appliedQuery}
          onChange={(e) => setQuery(e.target.value)}
          onClear={handleClear}
          loading={isSearching}
          placeholder="Search by name, university, or department..."
          className="mb-4"
        />
      </form>
      <CacheBackedList<SupervisorWithDetails>
        queryKey={queryKey}
        initialItems={isServerQuery ? supervisors : undefined}
        keepPreviousOnKeyChange
        fetchPage={(cursor) => getSupervisors(appliedQuery, 10, cursor)}
        renderItem={(s) => (
          <SupervisorCard
            key={s.id}
            supervisor={s}
            currentUserId={currentUserId}
          />
        )}
        className="grid min-w-0 w-full gap-6 md:grid-cols xl:grid-cols"
        emptyMessage={NO_SEARCH_MATCH}
        emptyState={
          searching ? undefined : (
            <div className="flex flex-col items-center rounded-[28px] border border-dashed border-slate-200 bg-white/80 px-6 py-16 text-center shadow-sm">
              <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-slate-50">
                <Plus className="w-8 h-8 text-slate-400" />
              </div>
              <p className="mb-6 text-lg font-medium text-slate-600">
                Couldn&apos;t find the supervisor you&apos;re looking for?
              </p>
              <Link prefetch={false}
                href="/supervisor/add"
                className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-6 py-3 font-semibold text-slate-900 shadow-sm transition-all hover:bg-slate-50 hover:border-slate-300"
              >
                Add them to <BrandMark className="font-semibold" />
              </Link>
            </div>
          )
        }
      />
    </div>
  );
}
