"use client";

import { useMemo } from "react";
import { useIsFetching } from "@tanstack/react-query";
import { useListSearch } from "@/hooks/useListSearch";
import { listEmptyMessage } from "@/lib/list-search";
import { SearchInput } from "@/components/ui/SearchInput";
import { CourseCard } from "./CourseCard";
import type { CourseWithAuthor } from "@/types/cards";
import { CacheBackedList } from "@/components/layout/CacheBackedList";
import { getCourses } from "@/app/actions/courses";

export function CoursesList({
  courses,
  currentUserId,
  initialQuery,
}: {
  courses: CourseWithAuthor[];
  currentUserId?: string;
  initialQuery?: string;
}) {
  const { query, setQuery, appliedQuery, isDebouncing, handleSearch, handleClear } = useListSearch(
    "/learn",
    initialQuery,
  );
  // Client-side search: the key tracks the applied term, so a new term fetches
  // its own first page instead of navigating and remounting the page.
  const queryKey = useMemo(
    () => ["courses", appliedQuery] as const,
    [appliedQuery],
  );
  const isFetching = useIsFetching({ queryKey, exact: true }) > 0;
  const isSearching = isDebouncing || isFetching;
  // Only the server-rendered term has data to seed the cache with.
  const isServerQuery = appliedQuery === (initialQuery ?? "");

  return (
    <div>
      <form onSubmit={handleSearch}>
        <SearchInput
          value={query}
          activeQuery={appliedQuery}
          onChange={(e) => setQuery(e.target.value)}
          onClear={handleClear}
          loading={isSearching}
          placeholder="Search by title, provider, instructor, or topic..."
          className="mb-4"
        />
      </form>
      <CacheBackedList<CourseWithAuthor>
        queryKey={queryKey}
        initialItems={isServerQuery ? courses : undefined}
        keepPreviousOnKeyChange
        fetchPage={(cursor) => getCourses(appliedQuery, 10, cursor)}
        renderItem={(course) => (
          <CourseCard
            key={(course as CourseWithAuthor).id}
            course={course as CourseWithAuthor}
            currentUserId={currentUserId}
          />
        )}
        className="grid gap-6 md:grid-cols xl:grid-cols"
        emptyMessage={listEmptyMessage(appliedQuery, "No courses found.")}
      />
    </div>
  );
}
