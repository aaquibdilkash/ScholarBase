"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SearchInput } from "@/components/ui/SearchInput";
import { CourseCard } from "./CourseCard";
import type { CourseWithAuthor } from "@/types/cards";
import { AppendMoreList } from "@/components/layout/AppendMoreList";

export function CoursesList({
  courses,
  currentUserId,
  initialQuery,
  loadMoreParams,
}: {
  courses: CourseWithAuthor[];
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
    router.push(`/learn?${params.toString()}`);
  };

  return (
    <div>
      <form onSubmit={handleSearch}>
        <SearchInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by title, provider, instructor, or topic..."
          className="mb-4"
        />
      </form>
      <AppendMoreList
        initialItems={courses}
        resource="courses"
        params={loadMoreParams}
        renderItem={(course) => (
          <CourseCard
            key={(course as CourseWithAuthor).id}
            course={course as CourseWithAuthor}
            currentUserId={currentUserId}
          />
        )}
        className="grid gap-6 md:grid-cols xl:grid-cols"
      />
    </div>
  );
}
