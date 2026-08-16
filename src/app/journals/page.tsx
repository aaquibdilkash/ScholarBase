import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Academic Journals Database - ISSN, Impact Factor & More",
  description: "Browse and discover academic journals, ISSN, impact factors, Scopus indexing, and publisher information.",
  path: "/journals",
  section: "Journals",
});
import { createClient } from "@/utils/supabase/server";

import ListPageShell from "@/components/layout/ListPageShell";
import { getJournals } from "../actions/journals";
import { JournalsList } from "@/components/journals/JournalsList";
import { getTrendingJournals } from "@/lib/trending";
import { TrendingList } from "@/components/feed/TrendingList";

export default async function JournalsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tab?: string }>;
}) {
  const { q, tab } = await searchParams;
  const pageSize = 10;
  const isTrendingTab = tab === "trending";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const journals = isTrendingTab ? [] : await getJournals(q, user?.id, pageSize);

  const trendingItems = isTrendingTab
    ? await getTrendingJournals()
    : [];

  // TypeScript can't infer the tagged union produced inside `getTrending(...)`.
  const typedTrendingItems =
    trendingItems as import("@/types/trending").TrendingItem[];

  return (
    <ListPageShell
      title="Journals"
      description="Browse and discover academic journals."
      addHref="/journals/add"
      addLabel="+ Add Journal"
      tab={tab}
      enableTrending={true}
      allHref="/journals"
      trendingHref="/journals?tab=trending"
      trending={
        <TrendingList
          items={typedTrendingItems}
          currentUserId={user?.id ?? ""}
        />
      }
      all={
        <JournalsList
          journals={journals}
          currentUserId={user?.id}
          initialQuery={q ?? ""}
          loadMoreParams={!isTrendingTab ? { q } : undefined}
        />
      }
    />
  );
}
