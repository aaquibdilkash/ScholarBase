import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Academic Results - Admissions, Exams & Notifications",
  description: "Admission results, exam outcomes, vacancy results, and other important academic notifications.",
  path: "/results",
  section: "Results",
});
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
  const pageSize = 10;
  const isTrendingTab = tab === "trending";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const results = isTrendingTab ? [] : await getResults(q, user?.id, pageSize);

  const trendingItems = (isTrendingTab
    ? await getTrendingResults()
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
          loadMoreParams={!isTrendingTab ? { q } : undefined}
        />
      }
    />
  );
}
