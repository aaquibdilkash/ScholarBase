import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";
import { SEO_PAGES, LIST_PAGE_TEXT } from "@/constants/seo";

export const metadata: Metadata = buildMetadata({
  title: SEO_PAGES.vacancies.title,
  description: SEO_PAGES.vacancies.description,
  path: SEO_PAGES.vacancies.path,
  section: SEO_PAGES.vacancies.section,
});
import { createClient } from "@/utils/supabase/server";
import ListPageShell from "@/components/layout/ListPageShell";
import { VacanciesList } from "@/components/vacancies/VacanciesList";
import { getTrendingVacancies } from "@/lib/trending";
import { TrendingList } from "@/components/feed/TrendingList";
import { getVacancies } from "@/app/actions/vacancies";
import { AsyncListRegion } from "@/components/cards/AsyncListRegion";

type TrendingItem = import("@/types/trending").TrendingItem;

export default async function VacanciesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tab?: string }>;
}) {
  const { q, tab } = await searchParams;
  const supabasePromise = createClient();

  return (
    <ListPageShell
      title={LIST_PAGE_TEXT.vacancies.title}
      description={LIST_PAGE_TEXT.vacancies.description}
      addHref="/vacancies/add"
      addLabel="+ Post Vacancy"
      tab={tab}
      enableTrending={true}
      allHref="/vacancies"
      trendingHref="/vacancies?tab=trending"
      trending={
        <AsyncListRegion
          fetcher={async () => {
            const supabase = await supabasePromise;
            const {
              data: { user },
            } = await supabase.auth.getUser();
            const items =
              (await getTrendingVacancies()) as unknown as TrendingItem[];
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
            const vacancies = await getVacancies(q ?? "", 10);
            return { vacancies, userId: user?.id };
          }}
        >
          {({ vacancies, userId }) => (
            <VacanciesList
              vacancies={vacancies}
              currentUserId={userId}
              initialQuery={q ?? ""}
            />
          )}
        </AsyncListRegion>
      }
    />
  );
}
