import { createClient } from "@/utils/supabase/server";
import { HelpPostList } from "@/components/help/HelpPostList";
import { getTrendingHelpPosts } from "@/lib/trending";
import { TrendingList } from "@/components/feed/TrendingList";
import { getHelpPosts } from "@/app/actions/help";
import ListPageShell from "@/components/layout/ListPageShell";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Scholar Suggest - ScholarBase",
  description:
    "Share suggestions, bug reports, or new feature request for ScholarBase with the community.",
};

export default async function HelpPage({
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

  const posts = isTrendingTab ? [] : await getHelpPosts(q, user?.id, pageSize);

  const trendingItems = (isTrendingTab
    ? await getTrendingHelpPosts()
    : []) as unknown as import("@/types/trending").TrendingItem[];

  return (
    <ListPageShell
      title="Scholar Suggest"
      description="Share posts, suggestions, bug reports, or new feature ideas with the community."
      addHref="/help/add"
      addLabel="+ New Post"
      tab={tab}
      enableTrending={true}
      allHref="/help"
      trendingHref="/help?tab=trending"
      trending={<TrendingList items={trendingItems} currentUserId={user?.id} />}
      all={
        <HelpPostList
          posts={posts}
          currentUserId={user?.id}
          initialQuery={q ?? ""}
          loadMoreParams={!isTrendingTab ? { q } : undefined}
        />
      }
    />
  );
}
