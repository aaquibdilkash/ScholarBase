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
import { AsyncListRegion } from "@/components/cards/AsyncListRegion";

type TrendingItem = import("@/types/trending").TrendingItem;

export default async function ResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tab?: string }>;
}) {
  const { q, tab } = await searchParams;
  const supabasePromise = createClient();

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
      trending={
        <AsyncListRegion
          fetcher={async () => {
            const supabase = await supabasePromise;
            const { data: { user } } = await supabase.auth.getUser();
            const items = (await getTrendingResults()) as unknown as TrendingItem[];
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
            const results = await getResults(q ?? "", user?.id, 10);
            return { results, userId: user?.id };
          }}
        >
          {({ results, userId }) => (
            <ResultsList
              results={results}
              initialQuery={q ?? ""}
              currentUserId={userId}
            />
          )}
        </AsyncListRegion>
      }
    />
  );
}
