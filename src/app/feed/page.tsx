import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Research Feed - Community Research Updates",
  description: "Short research updates, news, and conversations from the academic community on ScholarBase.",
  path: "/feed",
  section: "Community",
});
import { getFeed } from "@/app/actions/feed";
import { createClient } from "@/utils/supabase/server";

import ListPageShell from "@/components/layout/ListPageShell";
import { getTrendingSocialPosts } from "@/lib/trending";
import { TrendingList } from "@/components/feed/TrendingList";
import { FeedList } from "@/components/feed/FeedList";
import { CreateSocialPostFormWrapper } from "@/components/feed/CreateSocialPostFormWrapper";

type TrendingItem = import("@/types/trending").TrendingItem;

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string }>;
}) {
  const { tab, q } = await searchParams as { tab?: string; q?: string };
  const pageSize = 10;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isTrendingTab = tab === "trending";

  const posts = isTrendingTab ? [] : await getFeed(user?.id, tab, q, pageSize);

  let trendingItems: TrendingItem[] = [];
  if (isTrendingTab) {
    trendingItems = (await getTrendingSocialPosts().catch(
      () => [],
    )) as TrendingItem[];
  }

  return (
    <ListPageShell
      title="Research Feed"
      description="Short research updates from the community."
      tab={tab}
      enableTrending={true}
      allHref="/feed"
      trendingHref="/feed?tab=trending"
      trending={
        <TrendingList
          key="trending"
          items={trendingItems}
          currentUserId={user?.id}
        />
      }
      all={
        <>
          {!isTrendingTab && (
            <CreateSocialPostFormWrapper />
          )}
          <FeedList
            posts={posts}
            currentUserId={user?.id}
            initialQuery={q ?? ""}
            loadMoreParams={!isTrendingTab ? { q, tab } : undefined}
          />
        </>
      }
    />
  );
}
