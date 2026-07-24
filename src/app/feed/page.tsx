import { getFeed } from "@/app/actions/feed";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

import ListPageShell from "@/components/layout/ListPageShell";
import { getTrendingSocialPosts } from "@/lib/trending";
import { TrendingList } from "@/components/feed/TrendingList";
import { FeedList } from "@/components/feed/FeedList";
import { CreateSocialPostForm } from "@/components/feed/CreateSocialPostForm";

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string }>;
}) {
  const { tab, q } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const isTrendingTab = tab === "trending";

  const posts = isTrendingTab ? [] : await getFeed(user.id, tab, q);

  const trendingItems = (isTrendingTab
    ? await getTrendingSocialPosts(user.id)
    : []) as unknown as import("@/types/trending").TrendingItem[];

  return (
    <ListPageShell
      title="Scholar Feed"
      description="Short research updates from the community."
      tab={tab}
      enableTrending={true}
      allHref="/feed"
      trendingHref="/feed?tab=trending"
      trending={
        <TrendingList
          key="trending"
          items={trendingItems}
          currentUserId={user.id}
        />
      }
      all={
        <>
          {!isTrendingTab && <CreateSocialPostForm />}
          <FeedList
            posts={posts}
            currentUserId={user.id}
            initialQuery={q ?? ""}
          />
        </>
      }
    />
  );
}
