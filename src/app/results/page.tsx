import { createClient } from "@/utils/supabase/server";
import ListPageShell from "@/components/layout/ListPageShell";
import { ResultsList } from "@/components/results/ResultsList";
import { getTrendingResults } from "@/lib/trending";
import { TrendingList } from "@/components/feed/TrendingList";
import { getResults } from "@/app/actions/results";

export default async function ResultsPage({
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

  const results = isTrendingTab ? [] : await getResults(q, user?.id);

  const trendingItems = (isTrendingTab
    ? await getTrendingResults(user?.id)
    : []) as unknown as import("@/types/trending").TrendingItem[];

  return (
    <ListPageShell
      title="Results"
      description="Admission results, vacancy outcomes, exam results, and other important notifications."
      addHref="/results/add"
      addLabel="+ Add Result"
      tab={tab}
      enableTrending={true}
      allHref="/results"
      trendingHref="/results?tab=trending"
      trending={<TrendingList items={trendingItems} currentUserId={user?.id} />}
      all={
        <ResultsList
          results={results}
          initialQuery={q ?? ""}
          currentUserId={user?.id}
        />
      }
    />
  );
}
