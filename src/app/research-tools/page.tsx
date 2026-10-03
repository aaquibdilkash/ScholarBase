import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";
import { SEO_PAGES } from "@/constants/seo";

export const metadata: Metadata = buildMetadata({
  title: SEO_PAGES.researchTools.title,
  description: SEO_PAGES.researchTools.description,
  path: SEO_PAGES.researchTools.path,
  section: SEO_PAGES.researchTools.section,
});
import ListPageShell from "@/components/layout/ListPageShell";
import { createClient } from "@/utils/supabase/server";
import { getResearchTools } from "../actions/researchTools";
import { ResearchToolsList } from "@/components/research-tools/ResearchToolsList";
import { getTrendingResearchTools } from "@/lib/trending";
import { TrendingList } from "@/components/feed/TrendingList";
import { AsyncListRegion } from "@/components/cards/AsyncListRegion";

type TrendingItem = import("@/types/trending").TrendingItem;

export default async function ResearchToolsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tab?: string }>;
}) {
  const { q, tab } = await searchParams;
  const supabasePromise = createClient();

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
        <AsyncListRegion
          fetcher={async () => {
            const supabase = await supabasePromise;
            const {
              data: { user },
            } = await supabase.auth.getUser();
            const items =
              (await getTrendingResearchTools()) as unknown as TrendingItem[];
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
            const {
              data: { user },
            } = await supabase.auth.getUser();
            const tools = await getResearchTools(q ?? "", 10);
            return { tools, userId: user?.id };
          }}
        >
          {({ tools, userId }) => (
            <ResearchToolsList
              tools={tools}
              currentUserId={userId}
              initialQuery={q ?? ""}
            />
          )}
        </AsyncListRegion>
      }
    />
  );
}
