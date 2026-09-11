import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Research Grants",
  description:
    "Discover and share research grants, research scholarships, funding calls, application links, and guidance for scholars.",
  path: "/grants",
  section: "Grants",
});
import { createClient } from "@/utils/supabase/server";
import ListPageShell from "@/components/layout/ListPageShell";
import { ResearchGrantsList } from "@/components/grants/ResearchGrantsList";
import { getTrendingGrants } from "@/lib/trending";
import { TrendingList } from "@/components/feed/TrendingList";
import { getResearchGrants } from "@/app/actions/grants";
import { AsyncListRegion } from "@/components/cards/AsyncListRegion";

type TrendingItem = import("@/types/trending").TrendingItem;

export default async function ResearchGrantsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tab?: string }>;
}) {
  const { q, tab } = await searchParams;
  const supabasePromise = createClient();

  return (
    <ListPageShell
      title="Research Grants"
      description="Share funding opportunities, application guidance, research scholarships, and useful grant information with scholars."
      addHref="/grants/add"
      addLabel="+ Add Research Grant"
      tab={tab}
      enableTrending={true}
      allHref="/grants"
      trendingHref="/grants?tab=trending"
      trending={
        <AsyncListRegion
          fetcher={async () => {
            const supabase = await supabasePromise;
            const { data: { user } } = await supabase.auth.getUser();
            const items = (await getTrendingGrants()) as unknown as TrendingItem[];
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
            const grants = await getResearchGrants(q ?? "", user?.id, 10);
            return { grants, userId: user?.id };
          }}
        >
          {({ grants, userId }) => (
            <ResearchGrantsList
              grants={grants}
              currentUserId={userId}
              initialQuery={q ?? ""}
            />
          )}
        </AsyncListRegion>
      }
    />
  );
}
