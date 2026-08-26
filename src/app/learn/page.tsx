import type { Metadata } from "next";
import ListPageShell from "@/components/layout/ListPageShell";
import { createClient } from "@/utils/supabase/server";
import { getCourses } from "@/app/actions/courses";
import { getTrendingCourses } from "@/lib/trending";
import { TrendingList } from "@/components/feed/TrendingList";
import { CoursesList } from "@/components/courses/CoursesList";

export const metadata: Metadata = {
  title: "Courses",
  description: "Find and share research learning courses from YouTube, Udemy, universities, and other learning platforms.",
  alternates: { canonical: "/learn" },
};

export default async function CoursesPage({ searchParams }: { searchParams: Promise<{ q?: string; tab?: string }> }) {
  const { q, tab } = await searchParams;
  const pageSize = 10;
  const isTrendingTab = tab === "trending";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const courses = isTrendingTab ? [] : await getCourses(q, user?.id, pageSize);

  const trendingItems = (isTrendingTab
    ? await getTrendingCourses()
    : []) as unknown as import("@/types/trending").TrendingItem[];

  return (
    <ListPageShell
      title="Courses"
      description="Discover practical courses for research methods, writing, analysis, publishing, and scholarly skills."
      addHref="/learn/add"
      addLabel="+ Add Course"
      tab={tab}
      enableTrending={true}
      allHref="/learn"
      trendingHref="/learn?tab=trending"
      trending={<TrendingList items={trendingItems} currentUserId={user?.id} />}
      all={
        <CoursesList
          courses={courses}
          currentUserId={user?.id}
          initialQuery={q ?? ""}
          loadMoreParams={!isTrendingTab ? { q } : undefined}
        />
      }
    />
  );
}
