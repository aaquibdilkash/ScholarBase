import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";
import { SEO_PAGES, LIST_PAGE_TEXT } from "@/constants/seo";

export const metadata: Metadata = buildMetadata({
  title: SEO_PAGES.surveys.title,
  description: SEO_PAGES.surveys.description,
  path: SEO_PAGES.surveys.path,
  section: SEO_PAGES.surveys.section,
});
import { createClient } from "@/utils/supabase/server";
import ListPageShell from "@/components/layout/ListPageShell";
import { SurveysList } from "@/components/surveys/SurveysList";
import { getTrendingSurveys } from "@/lib/trending";
import { TrendingList } from "@/components/feed/TrendingList";
import { getSurveys } from "@/app/actions/surveys";
import { AsyncListRegion } from "@/components/cards/AsyncListRegion";

type TrendingItem = import("@/types/trending").TrendingItem;

export default async function SurveysPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tab?: string }>;
}) {
  const { q, tab } = await searchParams;
  const supabasePromise = createClient();

  return (
    <ListPageShell
      title={LIST_PAGE_TEXT.surveys.title}
      description={LIST_PAGE_TEXT.surveys.description}
      addHref="/surveys/add"
      addLabel="+ Create Survey"
      tab={tab}
      enableTrending={true}
      allHref="/surveys"
      trendingHref="/surveys?tab=trending"
      trending={
        <AsyncListRegion
          fetcher={async () => {
            const supabase = await supabasePromise;
            const {
              data: { user },
            } = await supabase.auth.getUser();
            const items =
              (await getTrendingSurveys()) as unknown as TrendingItem[];
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
            const surveys = await getSurveys(q ?? "", 10);
            return { surveys, userId: user?.id };
          }}
        >
          {({ surveys, userId }) => (
            <SurveysList
              surveys={surveys}
              initialQuery={q ?? ""}
              currentUserId={userId}
            />
          )}
        </AsyncListRegion>
      }
    />
  );
}
