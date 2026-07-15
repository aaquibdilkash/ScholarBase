import Link from "next/link";

import { createClient } from "@/utils/supabase/server";
import { getJournals } from "../actions/journals";
import { JournalsList } from "./components/JournalsList";
import { getTrendingJournals } from "@/lib/trending";
import { TrendingList } from "@/components/feed/TrendingList";

export default async function JournalsPage({
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

  const journals = isTrendingTab ? [] : await getJournals(user?.id);

  const trendingItems = isTrendingTab
    ? await getTrendingJournals(user?.id)
    : [];

  // TypeScript can't infer the tagged union produced inside `getTrending(...)`.
  const typedTrendingItems =
    trendingItems as import("@/types/trending").TrendingItem[];

  return (
    <main className="mx-auto max-w-6xl py-6">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
            Journals
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Browse and discover academic journals.
          </p>
        </div>
        <Link
          href="/journals/new"
          className="sb-button-accent whitespace-nowrap"
        >
          + Add Journal
        </Link>
      </div>

      <div className="mb-8 inline-flex rounded-2xl border border-slate-200 bg-white/80 p-1.5 shadow-sm">
        <Link
          href="/journals"
          className={`px-6 py-2 rounded-xl font-semibold transition-all ${
            !isTrendingTab
              ? "bg-slate-950 text-white shadow-sm"
              : "text-slate-500 hover:text-slate-900"
          }`}
        >
          All
        </Link>
        <Link
          href="/journals?tab=trending"
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
        <TrendingList items={typedTrendingItems} />
      ) : (
        <JournalsList journals={journals} />
      )}
    </main>
  );
}
