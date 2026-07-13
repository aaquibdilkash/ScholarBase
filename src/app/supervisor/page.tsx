import prisma from "@/lib/db";
import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { getTrendingSupervisors } from "@/lib/trending";
import { TrendingList } from "@/components/feed/TrendingList";
import { SupervisorCard } from "./components/SupervisorCard";
import { getCurrentUser } from "@/lib/auth";

export default async function SupervisorDirectory({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tab?: string }>;
}) {
  const { q, tab } = await searchParams;
  const isTrendingTab = tab === "trending";

  const user = await getCurrentUser();

  const supervisors = isTrendingTab
    ? []
    : await prisma.supervisor.findMany({
        where: q ? { name: { contains: q, mode: "insensitive" } } : {},
        include: {
          recommendations: true,
          likes: {
            where: {
              userId: user?.id,
            },
          },
          _count: {
            select: {
              comments: true,
              likes: true,
            },
          },
        },
      });

  const trendingItems = (isTrendingTab
    ? await getTrendingSupervisors(user?.id)
    : []) as unknown as import("@/types/trending").TrendingItem[];

  return (
    <main className="mx-auto max-w-5xl py-6">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="mb-2 text-3xl font-semibold tracking-tight text-slate-950">
            Find a Supervisor
          </h1>
          <p className="text-slate-600">
            Read and share mentorship experiences from fellow scholars.
          </p>
        </div>
        <Link
          href="/supervisor/add"
          className="sb-button-accent whitespace-nowrap"
        >
          + Add Supervisor
        </Link>
      </div>

      <div className="mb-8 inline-flex rounded-2xl border border-slate-200 bg-white/80 p-1.5 shadow-sm">
        <Link
          href="/supervisor"
          className={`px-6 py-2 rounded-xl font-semibold transition-all ${
            !isTrendingTab
              ? "bg-slate-950 text-white shadow-sm"
              : "text-slate-500 hover:text-slate-900"
          }`}
        >
          All
        </Link>
        <Link
          href="/supervisor?tab=trending"
          className={`px-6 py-2 rounded-xl font-semibold transition-all ${
            isTrendingTab
              ? "bg-slate-950 text-white shadow-sm"
              : "text-slate-500 hover:text-slate-900"
          }`}
        >
          Trending
        </Link>
      </div>

      {!isTrendingTab && (
        <form className="relative mb-10">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
            <svg
              className="h-5 w-5 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <input
            name="q"
            placeholder="Search by professor's name..."
            className="sb-input pl-12"
            defaultValue={q}
          />
        </form>
      )}

      {isTrendingTab ? (
        <TrendingList items={trendingItems} />
      ) : supervisors.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2">
          {supervisors.map((s) => (
            <SupervisorCard
              key={s.id}
              supervisor={s}
              currentUserId={user?.id}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center rounded-[28px] border border-dashed border-slate-200 bg-white/80 px-6 py-16 text-center shadow-sm">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-slate-50">
            <svg
              className="w-8 h-8 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 4v16m8-8H4"
              ></path>
            </svg>
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
      )}
    </main>
  );
}
