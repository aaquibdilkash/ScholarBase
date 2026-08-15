"use client";

import { FilterableOpportunityList } from "@/components/opportunities/FilterableList";
import { CourseCard } from "./CourseCard";
import type { CourseWithAuthor } from "@/types/cards";

export function CoursesList({
  courses,
  currentUserId,
  initialQuery,
}: {
  courses: CourseWithAuthor[];
  currentUserId?: string;
  initialQuery?: string;
}) {
  return (
    <FilterableOpportunityList
      items={courses}
      placeholder="Search by title, provider, instructor, or topic..."
      filterFn={(course, query) => {
        const q = query.toLowerCase();
        return (
          course.title.toLowerCase().includes(q) ||
          (course.provider?.toLowerCase().includes(q) ?? false) ||
          (course.instructor?.toLowerCase().includes(q) ?? false) ||
          (course.level?.toLowerCase().includes(q) ?? false) ||
          course.description.toLowerCase().includes(q) ||
          (course.author.name?.toLowerCase().includes(q) ?? false)
        );
      }}
      renderItem={(course) => <CourseCard key={course.id} course={course} currentUserId={currentUserId} />}
      initialQuery={initialQuery ?? ""}
      queryParamKey="q"
      basePath="/learn"
    />
  );
}
