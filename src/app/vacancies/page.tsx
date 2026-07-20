import { createClient } from "@/utils/supabase/server";
import ListPageShell from "@/components/layout/ListPageShell";
import { VacanciesList } from "@/components/vacancies/VacanciesList";
import { getTrendingVacancies } from "@/lib/trending";
import { TrendingList } from "@/components/feed/TrendingList";
import { getVacancies } from "@/app/actions/vacancies";

export default async function VacanciesPage({
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

  const vacancies = isTrendingTab ? [] : await getVacancies(q, user?.id);

  const trendingItems = (isTrendingTab
    ? await getTrendingVacancies(user?.id)
    : []) as unknown as import("@/types/trending").TrendingItem[];

  return (
    <ListPageShell
      title="Academic Vacancies"
      description="Contract, guest, and permanent openings across institutions."
      addHref="/vacancies/add"
      addLabel="+ Post Vacancy"
      tab={tab}
      enableTrending={true}
      allHref="/vacancies"
      trendingHref="/vacancies?tab=trending"
      trending={<TrendingList items={trendingItems} currentUserId={user?.id} />}
      all={
        <VacanciesList
          vacancies={vacancies}
          currentUserId={user?.id}
          initialQuery={q ?? ""}
        />
      }
    />
  );
}
