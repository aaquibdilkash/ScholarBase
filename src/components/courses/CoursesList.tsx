"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { buildSearchHref } from "@/lib/list-search";
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
  const [query, setQuery] = useState(initialQuery ?? "");
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";
  // Part of the cache key so every cached search variant stays independent.
  const queryKey = useMemo(() => ["courses", q] as const, [q]);


  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Empty input clears `?q` so the page falls back to the unfiltered list.
    router.push(buildSearchHref("/learn", window.location.search, query));
  };

  return (
    <div>
      <form onSubmit={handleSearch}>
        <SearchInput
          value={query}
          activeQuery={initialQuery}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by title, provider, instructor, or topic..."
          className="mb-4"
        />
      </form>
      <CacheBackedList<CourseWithAuthor>
        queryKey={queryKey}
        initialItems={courses}
        fetchPage={(cursor) => getCourses(q, 10, cursor)}
        renderItem={(course) => (
          <CourseCard
            key={(course as CourseWithAuthor).id}
            course={course as CourseWithAuthor}
            currentUserId={currentUserId}
          />
        )}
        className="grid gap-6 md:grid-cols xl:grid-cols"
        emptyMessage="No courses found."
      />
    </div>
  );
}
