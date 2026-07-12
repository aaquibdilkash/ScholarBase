import Link from "next/link";
import prisma from "@/lib/db";
import { createClient } from "@/utils/supabase/server";

import { AdmissionsList } from "./components/AdmissionsList";
import { getTrendingAdmissions } from "@/lib/trending";
import { TrendingList } from "@/components/feed/TrendingList";

export default async function AdmissionsPage({
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

  const admissions = isTrendingTab
    ? []
    : await prisma.phdAdmission.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          author: true,
          likes: user ? { where: { userId: user.id } } : false,
          _count: {
            select: { likes: true, comments: true },
          },
        },
      });

  const trendingItems = isTrendingTab
    ? await getTrendingAdmissions(user?.id)
    : [];

  return (
    <main className="mx-auto max-w-6xl py-6">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
            PhD Admissions
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Admissions and seat notifications from universities.
          </p>
        </div>
        <Link
          href="/admissions/new"
          className="sb-button-accent whitespace-nowrap"
        >
          + Post Admission
        </Link>
      </div>

      <div className="mb-8 inline-flex rounded-2xl border border-slate-200 bg-white/80 p-1.5 shadow-sm">
        <Link
          href="/admissions"
          className={`px-6 py-2 rounded-xl font-semibold transition-all ${
            !isTrendingTab
              ? "bg-slate-950 text-white shadow-sm"
              : "text-slate-500 hover:text-slate-900"
          }`}
        >
          All
        </Link>
        <Link
          href="/admissions?tab=trending"
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
        <AdmissionsList admissions={admissions} />
      )}
    </main>
  );
}
