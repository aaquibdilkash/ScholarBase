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
import { AsyncListRegion } from "@/components/cards/AsyncListRegion";

export default async function SupervisorDirectory({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tab?: string }>;
}) {
  const { q, tab } = await searchParams;
  // Auth resolved lazily so the shell heading/tabs render instantly.
  const userPromise = getCurrentUser();

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
      trending={
        <AsyncListRegion
          fetcher={async () => {
            const user = await userPromise;
            const items = (await getTrendingSupervisors()) as unknown as import("@/types/trending").TrendingItem[];
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
            const user = await userPromise;
            const supervisors = await getSupervisors(q, user?.id);
            return { supervisors, userId: user?.id };
          }}
        >
          {({ supervisors, userId }) => (
            <SupervisorsList
              supervisors={supervisors}
              currentUserId={userId ?? ""}
              initialQuery={q ?? ""}
            />
          )}
        </AsyncListRegion>
      }
    />
  );
}
