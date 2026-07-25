import { createClient } from "@/utils/supabase/server";
import ListPageShell from "@/components/layout/ListPageShell";
import { ContributionsList } from "@/components/contributions/ContributionsList";
import { getTrendingContributions } from "@/lib/trending";
import { TrendingList } from "@/components/feed/TrendingList";
import { getContributions } from "@/app/actions/contributions";

export default async function ContributionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tab?: string }>;
}) {
  const { q, tab } = await searchParams;
  const isTrendingTab = tab === "trending";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const contributions = isTrendingTab
    ? []
    : await getContributions(q, user?.id);

  const trendingItems = (isTrendingTab
    ? await getTrendingContributions(user?.id)
    : []) as unknown as import("@/types/trending").TrendingItem[];

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
      trending={<TrendingList items={trendingItems} currentUserId={user?.id} />}
      all={
        <ContributionsList
          contributions={contributions}
          initialQuery={q ?? ""}
          currentUserId={user?.id}
        />
      }
    />
  );
}
