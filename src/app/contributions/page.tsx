import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Contributions - Support ScholarBase",
  description: "Support ScholarBase and see how the community fuels its servers, infrastructure, and growth.",
  path: "/contributions",
  section: "Contributions",
});
import { createClient } from "@/utils/supabase/server";
import ListPageShell from "@/components/layout/ListPageShell";
import { ContributionsList } from "@/components/contributions/ContributionsList";
import { getTrendingContributions } from "@/lib/trending";
import { TrendingList } from "@/components/feed/TrendingList";
import { getContributions } from "@/app/actions/contributions";
import { AsyncListRegion } from "@/components/cards/AsyncListRegion";

type TrendingItem = import("@/types/trending").TrendingItem;

export default async function ContributionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tab?: string }>;
}) {
  const { q, tab } = await searchParams;
  const supabasePromise = createClient();

  return (
    <ListPageShell
      title="Contributions"
      description="Support ScholarBase and see who's contributing to the community."
      addHref="/contributions/add"
      addLabel="+ Add Contribution"
      tab={tab}
      enableTrending={true}
      allHref="/contributions"
      trendingHref="/contributions?tab=trending"
      trending={
        <AsyncListRegion
          fetcher={async () => {
            const supabase = await supabasePromise;
            const { data: { user } } = await supabase.auth.getUser();
            const items = (await getTrendingContributions()) as unknown as TrendingItem[];
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
            const contributions = await getContributions(q ?? "", user?.id, 10);
            return { contributions, userId: user?.id };
          }}
        >
          {({ contributions, userId }) => (
            <ContributionsList
              contributions={contributions}
              initialQuery={q ?? ""}
              currentUserId={userId}
            />
          )}
        </AsyncListRegion>
      }
    />
  );
}
