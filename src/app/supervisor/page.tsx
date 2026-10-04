import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";
import { SEO_PAGES, LIST_PAGE_TEXT } from "@/constants/seo";

export const metadata: Metadata = buildMetadata({
  title: SEO_PAGES.supervisor.title,
  description: SEO_PAGES.supervisor.description,
  path: SEO_PAGES.supervisor.path,
  section: SEO_PAGES.supervisor.section,
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
      title={LIST_PAGE_TEXT.supervisor.title}
      description={LIST_PAGE_TEXT.supervisor.description}
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
            const items =
              (await getTrendingSupervisors()) as unknown as import("@/types/trending").TrendingItem[];
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
            // Viewer identity is resolved inside the action; the page does not
            // pass a userId down to the data layer.
            const supervisors = await getSupervisors(q);
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
