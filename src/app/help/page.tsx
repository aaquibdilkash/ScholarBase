import { createClient } from "@/utils/supabase/server";
import { HelpPostList } from "@/components/help/HelpPostList";
import { getTrendingHelpPosts } from "@/lib/trending";
import { TrendingList } from "@/components/feed/TrendingList";
import { getHelpPosts } from "@/app/actions/help";
import ListPageShell from "@/components/layout/ListPageShell";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Help & Support - ScholarBase",
  description:
    "Get help from the community, ask questions, and find solutions to your problems.",
};

export default async function HelpPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tab?: string }>;
}) {
  const { q, tab } = await searchParams;
  const isTrendingTab = tab === "trending";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const posts = isTrendingTab ? [] : await getHelpPosts(q, user?.id);

  const trendingItems = (isTrendingTab
    ? await getTrendingHelpPosts()
    : []) as unknown as import("@/types/trending").TrendingItem[];

  return (
    <ListPageShell
      title="Help & Support"
      description="Get help from the community."
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
        />
      }
    />
  );
}
