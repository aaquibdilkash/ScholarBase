import { createSocialPost, getFeed } from "@/app/actions/feed";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

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
  
  const posts = isTrendingTab
    ? []
    : await getFeed(user.id, tab, q);

  const trendingItems = (isTrendingTab
    ? await getTrendingSocialPosts(user.id)
    : []) as unknown as import("@/types/trending").TrendingItem[];

  return (
    <main className="mx-auto max-w-3xl py-6">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
            Scholar Feed
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Short research updates from the community.
          </p>
        </div>
      </div>

      <div className="mb-8 inline-flex rounded-2xl border border-slate-200 bg-white/80 p-1.5 shadow-sm">
        <Link
          href="/feed"
          className={`px-6 py-2 rounded-xl font-semibold transition-all ${
            !tab
              ? "bg-slate-950 text-white shadow-sm"
              : "text-slate-500 hover:text-slate-900"
          }`}
        >
          All
        </Link>
        <Link
          href="/feed?tab=following"
          className={`px-6 py-2 rounded-xl font-semibold transition-all ${
            tab === "following"
              ? "bg-slate-950 text-white shadow-sm"
              : "text-slate-500 hover:text-slate-900"
          }`}
        >
          Following
        </Link>
        <Link
          href="/feed?tab=trending"
          className={`px-6 py-2 rounded-xl font-semibold transition-all ${
            isTrendingTab
              ? "bg-slate-950 text-white shadow-sm"
              : "text-slate-500 hover:text-slate-900"
          }`}
        >
          Trending
        </Link>
      </div>

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

      {isTrendingTab ? (
        <TrendingList
          key="trending"
          items={trendingItems}
          currentUserId={user.id}
        />
      ) : (
        <FeedList
          posts={posts}
          currentUserId={user.id}
          initialQuery={q ?? ""}
        />
      )}
    </main>
  );
}
