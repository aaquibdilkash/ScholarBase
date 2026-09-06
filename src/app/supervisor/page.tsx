import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Find PhD Supervisors - Reviews, Ratings & Recommendations",
  description: "Search for PhD supervisors by university and department, and read student ratings and recommendations.",
  path: "/supervisor",
  section: "Supervisors",
});
import ListPageShell from "@/components/layout/ListPageShell";
import { TrendingList } from "@/components/feed/TrendingList";
import { SupervisorsList } from "@/components/supervisor/SupervisorsList";
import { getCurrentUser } from "@/lib/auth";
import { getTrendingSupervisors } from "@/lib/trending";
import { getSupervisors } from "@/app/actions/supervisors";

export default async function SupervisorDirectory({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tab?: string }>;
}) {
  const { q, tab } = await searchParams;
  const isTrendingTab = tab === "trending";

  const user = await getCurrentUser();

  const supervisors = isTrendingTab ? [] : await getSupervisors(q, user?.id);

  const trendingItems = (isTrendingTab
    ? await getTrendingSupervisors()
    : []) as unknown as import("@/types/trending").TrendingItem[];

  return (
    <ListPageShell
      title="Find a Supervisor"
      description="Read and share mentorship experiences from fellow scholars."
      addHref="/supervisor/add"
      addLabel="+ Add Supervisor"
      tab={tab}
      enableTrending={true}
      allHref="/supervisor"
      trendingHref="/supervisor?tab=trending"
      trending={<TrendingList items={trendingItems} currentUserId={user?.id} />}
      all={
        !isTrendingTab ? (
          <SupervisorsList
            supervisors={supervisors}
            currentUserId={user?.id}
            initialQuery={q ?? ""}
          />
        ) : null
      }
    />
  );
}
