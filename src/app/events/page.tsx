import Link from "next/link";
import prisma from "@/lib/db";
import { createClient } from "@/utils/supabase/server";
import { EventsList } from "./components/EventsList";
import { getTrendingEvents } from "@/lib/trending";
import { TrendingList } from "@/components/feed/TrendingList";

export default async function EventsPage({
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

  const events = isTrendingTab
    ? []
    : await prisma.researchEvent.findMany({
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
    ? await getTrendingEvents(user?.id)
    : []) as unknown as import("@/types/trending").TrendingItem[];

  return (
    <main className="mx-auto max-w-6xl py-6">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
            Research Events & Conferences
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Conferences, calls, and academic gatherings worth tracking.
          </p>
        </div>
        <Link href="/events/new" className="sb-button-accent whitespace-nowrap">
          + Add Event
        </Link>
      </div>

      <div className="mb-8 inline-flex rounded-2xl border border-slate-200 bg-white/80 p-1.5 shadow-sm">
        <Link
          href="/events"
          className={`px-6 py-2 rounded-xl font-semibold transition-all ${
            !isTrendingTab
              ? "bg-slate-950 text-white shadow-sm"
              : "text-slate-500 hover:text-slate-900"
          }`}
        >
          All
        </Link>
        <Link
          href="/events?tab=trending"
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
        <EventsList events={events} />
      )}
    </main>
  );
}
