"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { SearchInput } from "@/components/ui/SearchInput";
import { CourseCard } from "./CourseCard";
import type { CourseWithAuthor } from "@/types/cards";
import { AppendMoreList } from "@/components/layout/AppendMoreList";
import { getCourses } from "@/app/actions/courses";

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
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";

  const { data: coursesData } = useQuery({
    queryKey: ["courses", q],
    queryFn: () => getCourses(q, currentUserId),
    initialData: courses,
  });

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
        initialItems={coursesData}
        resource="courses"
        params={{ q, ...loadMoreParams }}
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
