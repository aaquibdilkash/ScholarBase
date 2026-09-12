import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Courses",
  description: "Find and share research learning courses from YouTube, Udemy, universities, and other learning platforms.",
  path: "/learn",
  section: "Courses",
});
import { createClient } from "@/utils/supabase/server";
import ListPageShell from "@/components/layout/ListPageShell";
import { CoursesList } from "@/components/courses/CoursesList";
import { getCourses } from "@/app/actions/courses";
import { getTrendingCourses } from "@/lib/trending";
import { TrendingList } from "@/components/feed/TrendingList";
import { AsyncListRegion } from "@/components/cards/AsyncListRegion";

type TrendingItem = import("@/types/trending").TrendingItem;

export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tab?: string }>;
}) {
  const { q, tab } = await searchParams;
  const supabasePromise = createClient();

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
      trending={
        <AsyncListRegion
          fetcher={async () => {
            const supabase = await supabasePromise;
            const { data: { user } } = await supabase.auth.getUser();
            const items = (await getTrendingCourses()) as unknown as TrendingItem[];
            return { items, userId: user?.id };
          }}
        >
          {({ items, userId }) => (
            <TrendingList items={items} currentUserId={userId ?? ""} />
          )}
        </AsyncListRegion>
      }
      all={
        <AsyncListRegion
          key={q}
          fetcher={async () => {
            const supabase = await supabasePromise;
            const { data: { user } } = await supabase.auth.getUser();
            const courses = await getCourses(q ?? "", user?.id, 10);
            return { courses, userId: user?.id };
          }}
        >
          {({ courses, userId }) => (
            <CoursesList
              courses={courses}
              currentUserId={userId}
              initialQuery={q ?? ""}
            />
          )}
        </AsyncListRegion>
      }
    />
  );
}
