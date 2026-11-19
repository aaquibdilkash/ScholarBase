import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";
import { SEO_PAGES, LIST_PAGE_TEXT } from "@/constants/seo";
import { createClient } from "@/utils/supabase/server";
import ListPageShell from "@/components/layout/ListPageShell";
import { ResultsList } from "@/components/results/ResultsList";
import { getTrendingResults } from "@/lib/trending";
import { TrendingList } from "@/components/feed/TrendingList";
import { getResults } from "@/app/actions/results";
import { AsyncListRegion } from "@/components/cards/AsyncListRegion";
import { RESULTS_ADD_PATH, RESULTS_BASE_PATH } from "@/lib/results/routes";

export const metadata: Metadata = buildMetadata({
  title: SEO_PAGES.examsAndResults.title,
  description: SEO_PAGES.examsAndResults.description,
  path: SEO_PAGES.examsAndResults.path,
  section: SEO_PAGES.examsAndResults.section,
});

type TrendingItem = import("@/types/trending").TrendingItem;

export default async function ExamsAndResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tab?: string }>;
}) {
  const { q, tab } = await searchParams;
  const supabasePromise = createClient();

  return (
    <ListPageShell
      title={LIST_PAGE_TEXT.examsAndResults.title}
      description={LIST_PAGE_TEXT.examsAndResults.description}
      addHref={RESULTS_ADD_PATH}
      addLabel="+ Add Exam or Result"
      tab={tab}
      enableTrending={true}
      allHref={RESULTS_BASE_PATH}
      trendingHref={`${RESULTS_BASE_PATH}?tab=trending`}
      trending={
        <AsyncListRegion
          fetcher={async () => {
            const supabase = await supabasePromise;
            const {
              data: { user },
            } = await supabase.auth.getUser();
            const items =
              (await getTrendingResults()) as unknown as TrendingItem[];
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
            const {
              data: { user },
            } = await supabase.auth.getUser();
            const results = await getResults(q ?? "", 10);
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
