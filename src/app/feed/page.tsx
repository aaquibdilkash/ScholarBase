import { createSocialPost, getFeed } from "@/app/actions/feed";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

import ListPageShell from "@/components/layout/ListPageShell";
import { getTrendingSocialPosts } from "@/lib/trending";
import { TrendingList } from "@/components/feed/TrendingList";
import { FeedList } from "@/components/feed/FeedList";

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
          {!isTrendingTab && (
            <div className="sb-surface-strong mb-10 p-6 md:p-7">
              <form action={createSocialPost} className="flex flex-col gap-4">
                <textarea
                  name="content"
                  placeholder="What are you researching today?"
                  className="w-full resize-none border-none bg-transparent p-2 text-lg text-slate-800 outline-none placeholder:text-slate-400 focus:ring-0"
                  rows={3}
                  required
                />
                <div className="flex justify-end border-t border-slate-100 pt-4">
                  <button type="submit" className="sb-button-accent">
                    Post Update
                  </button>
                </div>
              </form>
            </div>
          )}
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
