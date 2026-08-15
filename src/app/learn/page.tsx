import type { Metadata } from "next";
import ListPageShell from "@/components/layout/ListPageShell";
import { createClient } from "@/utils/supabase/server";
import { getCourses } from "@/app/actions/courses";
import { CoursesList } from "@/components/courses/CoursesList";

export const metadata: Metadata = {
  title: "Courses",
  description: "Find and share research learning courses from YouTube, Udemy, universities, and other learning platforms.",
  alternates: { canonical: "/learn" },
};

export default async function CoursesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const courses = await getCourses(q, user?.id);

  return (
    <ListPageShell
      title="Courses"
      description="Discover practical courses for research methods, writing, analysis, publishing, and scholarly skills."
      addHref="/learn/add"
      addLabel="+ Add Course"
      enableTrending={false}
      allHref="/learn"
      trending={null}
      all={<CoursesList courses={courses} currentUserId={user?.id} initialQuery={q ?? ""} />}
    />
  );
}
