import { createClient } from "@/utils/supabase/server";
import ListPageShell from "@/components/layout/ListPageShell";
import { SurveysList } from "@/components/surveys/SurveysList";
import { getTrendingSurveys } from "@/lib/trending";
import { TrendingList } from "@/components/feed/TrendingList";
import { getSurveys } from "@/app/actions/surveys";

export default async function SurveysPage({
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

  const surveys = isTrendingTab ? [] : await getSurveys(q, user?.id);

  const trendingItems = (isTrendingTab
    ? await getTrendingSurveys(user?.id)
    : []) as unknown as import("@/types/trending").TrendingItem[];

  return (
    <ListPageShell
      title="Research Survey"
      description="Create and participate in research surveys. Better than Google Forms — built for the academic community."
      addHref="/surveys/add"
      addLabel="+ Create Survey"
      tab={tab}
      enableTrending={true}
      allHref="/surveys"
      trendingHref="/surveys?tab=trending"
      trending={<TrendingList items={trendingItems} currentUserId={user?.id} />}
      all={
        <SurveysList
          surveys={surveys}
          initialQuery={q ?? ""}
          currentUserId={user?.id}
        />
      }
    />
  );
}
