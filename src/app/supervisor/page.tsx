import { Plus } from "lucide-react";
import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import ListPageShell from "@/components/layout/ListPageShell";
import { TrendingList } from "@/components/feed/TrendingList";
import { SupervisorsList } from "@/components/supervisor/SupervisorsList";
import { getCurrentUser } from "@/lib/auth";
import { getTrendingSupervisors } from "@/lib/trending";
import { getSupervisors } from "@/app/actions/supervisors";

export default async function SupervisorDirectory({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tab?: string }>;
}) {
  const { q, tab } = await searchParams;
  const isTrendingTab = tab === "trending";

  const user = await getCurrentUser();

  const supervisors = isTrendingTab ? [] : await getSupervisors(q, user?.id);

  const trendingItems = (isTrendingTab
    ? await getTrendingSupervisors(user?.id)
    : []) as unknown as import("@/types/trending").TrendingItem[];

  return (
    <ListPageShell
      title="Find a Supervisor"
      description="Read and share mentorship experiences from fellow scholars."
      addHref="/supervisor/add"
      addLabel="+ Add Supervisor"
      tab={tab}
      enableTrending={true}
      allHref="/supervisor"
      trendingHref="/supervisor?tab=trending"
      trending={<TrendingList items={trendingItems} currentUserId={user?.id} />}
      all={
        !isTrendingTab ? (
          !supervisors.length ? (
            <div className="flex flex-col items-center rounded-[28px] border border-dashed border-slate-200 bg-white/80 px-6 py-16 text-center shadow-sm">
              <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-slate-50">
                <Plus className="w-8 h-8 text-slate-400" />
              </div>
              <p className="mb-6 text-lg font-medium text-slate-600">
                Couldn&apos;t find the supervisor you&apos;re looking for?
              </p>
              <Link
                href="/supervisor/add"
                className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-6 py-3 font-semibold text-slate-900 shadow-sm transition-all hover:bg-slate-50 hover:border-slate-300"
              >
                Add them to <BrandMark className="font-semibold" />
              </Link>
            </div>
          ) : (
            <SupervisorsList
              supervisors={supervisors}
              currentUserId={user?.id}
              initialQuery={q ?? ""}
            />
          )
        ) : null
      }
    />
  );
}
