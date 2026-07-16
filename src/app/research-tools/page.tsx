import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { getResearchTools } from "../actions/researchTools";
import { ResearchToolsList } from "./components/ResearchToolsList";
import { getTrendingResearchTools } from "@/lib/trending";
import { TrendingList } from "@/components/feed/TrendingList";

export default async function ResearchPage({
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

  const tools = isTrendingTab ? [] : await getResearchTools(user?.id);

  const trendingItems = isTrendingTab
    ? await getTrendingResearchTools(user?.id)
    : [];

  // TypeScript can't infer the tagged union produced inside `getTrending(...)`.
  const typedTrendingItems =
    trendingItems as import("@/types/trending").TrendingItem[];

  return (
    <main className="mx-auto max-w-6xl py-6">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
            Research Tools
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Discover and share tools that can help with your research.
          </p>
        </div>
        <Link
          href="/research-tools/add"
          className="sb-button-accent whitespace-nowrap"
        >
          + Add Research Tool
        </Link>
      </div>

      <div className="mb-8 inline-flex rounded-2xl border border-slate-200 bg-white/80 p-1.5 shadow-sm">
        <Link
          href="/research-tools"
          className={`px-6 py-2 rounded-xl font-semibold transition-all ${
            !isTrendingTab
              ? "bg-slate-950 text-white shadow-sm"
              : "text-slate-500 hover:text-slate-900"
          }`}
        >
          All
        </Link>
        <Link
          href="/research-tools?tab=trending"
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
        <ResearchToolsList tools={tools} />
      )}
    </main>
  );
}
