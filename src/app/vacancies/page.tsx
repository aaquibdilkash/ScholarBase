import Link from "next/link";
import prisma from "@/lib/db";
import { createClient } from "@/utils/supabase/server";
import { VacanciesList } from "./components/VacanciesList";
import { getTrendingVacancies } from "@/lib/trending";
import { TrendingList } from "@/components/feed/TrendingList";

export default async function VacanciesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const isTrendingTab = tab === "trending";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const vacancies = isTrendingTab
    ? []
    : await prisma.jobVacancy.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          author: true,
          likes: user ? { where: { userId: user.id } } : false,
          _count: {
            select: { likes: true, comments: true },
          },
        },
      });

  const trendingItems = (isTrendingTab
    ? await getTrendingVacancies(user?.id)
    : []) as unknown as import("@/types/trending").TrendingItem[];

  return (
    <main className="mx-auto max-w-6xl py-6">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
            Academic Vacancies
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Contract, guest, and permanent openings across institutions.
          </p>
        </div>
        <Link
          href="/vacancies/new"
          className="sb-button-accent whitespace-nowrap"
        >
          + Post Vacancy
        </Link>
      </div>

      <div className="mb-8 inline-flex rounded-2xl border border-slate-200 bg-white/80 p-1.5 shadow-sm">
        <Link
          href="/vacancies"
          className={`px-6 py-2 rounded-xl font-semibold transition-all ${
            !isTrendingTab
              ? "bg-slate-950 text-white shadow-sm"
              : "text-slate-500 hover:text-slate-900"
          }`}
        >
          All
        </Link>
        <Link
          href="/vacancies?tab=trending"
          className={`px-6 py-2 rounded-xl font-semibold transition-all ${
            isTrendingTab
              ? "bg-slate-950 text-white shadow-sm"
              : "text-slate-500 hover:text-slate-900"
          }`}
        >
          Trending
        </Link>
      </div>

      {isTrendingTab ? (
        <TrendingList items={trendingItems} />
      ) : (
        <VacanciesList vacancies={vacancies} />
      )}
    </main>
  );
}
