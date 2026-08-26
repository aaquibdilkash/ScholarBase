import type { Metadata } from "next";
import ListPageShell from "@/components/layout/ListPageShell";
import { createClient } from "@/utils/supabase/server";
import { getResearchGrants } from "@/app/actions/grants";
import { getTrendingGrants } from "@/lib/trending";
import { TrendingList } from "@/components/feed/TrendingList";
import { ResearchGrantsList } from "@/components/grants/ResearchGrantsList";

export const metadata: Metadata = {
  title: "Research Grants",
  description: "Discover and share research grants, research scholarships, funding calls, application links, and guidance for scholars.",
  alternates: { canonical: "/grants" },
};

export default async function ResearchGrantsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tab?: string }>;
}) {
  const { q, tab } = await searchParams as { q?: string; tab?: string };
  const pageSize = 10;
  const isTrendingTab = tab === "trending";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const grants = isTrendingTab ? [] : await getResearchGrants(q, user?.id, pageSize);

  const trendingItems = (isTrendingTab
    ? await getTrendingGrants()
    : []) as unknown as import("@/types/trending").TrendingItem[];

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
      trending={<TrendingList items={trendingItems} currentUserId={user?.id} />}
      all={
        <ResearchGrantsList
          grants={grants}
          currentUserId={user?.id}
          initialQuery={q ?? ""}
          loadMoreParams={!isTrendingTab ? { q } : undefined}
        />
      }
    />
  );
}
