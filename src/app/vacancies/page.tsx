import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Academic Vacancies - ScholarBase",
  description:
    "Find the latest academic job openings, research positions, and faculty vacancies from institutions around the world.",
  path: "/vacancies",
  section: "Academic Vacancies",
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
      title="Academic Vacancies"
      description="Contract, guest, and permanent openings across institutions."
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
            const { data: { user } } = await supabase.auth.getUser();
            const items = (await getTrendingVacancies()) as unknown as TrendingItem[];
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
            const vacancies = await getVacancies(q ?? "", user?.id, 10);
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
