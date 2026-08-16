import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Research Tools & Software for Academics",
  description: "Discover and share software, apps, and digital tools that can help with your research.",
  path: "/research-tools",
  section: "Research Tools",
});
import ListPageShell from "@/components/layout/ListPageShell";
import { createClient } from "@/utils/supabase/server";
import { getResearchTools } from "../actions/researchTools";
import { ResearchToolsList } from "@/components/research-tools/ResearchToolsList";
import { getTrendingResearchTools } from "@/lib/trending";
import { TrendingList } from "@/components/feed/TrendingList";

export default async function ResearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tab?: string }>;
}) {
  const { q, tab } = await searchParams as { q?: string; tab?: string };
  const pageSize = 10;
  const isTrendingTab = tab === "trending";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const tools = isTrendingTab ? [] : await getResearchTools(q, user?.id, pageSize);

  const trendingItems = isTrendingTab
    ? await getTrendingResearchTools()
    : [];

  // TypeScript can't infer the tagged union produced inside `getTrending(...)`.
  const typedTrendingItems =
    trendingItems as import("@/types/trending").TrendingItem[];

  return (
    <ListPageShell
      title="Research Tools"
      description="Discover and share tools that can help with your research."
      addHref="/research-tools/add"
      addLabel="+ Add Research Tool"
      tab={tab}
      enableTrending={true}
      allHref="/research-tools"
      trendingHref="/research-tools?tab=trending"
      trending={
        <TrendingList
          items={typedTrendingItems}
          currentUserId={user?.id ?? ""}
        />
      }
      all={
        <ResearchToolsList
          tools={tools}
          currentUserId={user?.id}
          initialQuery={q ?? ""}
          loadMoreParams={!isTrendingTab ? { q } : undefined}
        />
      }
    />
  );
}
