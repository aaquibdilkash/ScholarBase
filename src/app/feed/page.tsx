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
import { AsyncListRegion } from "@/components/cards/AsyncListRegion";

type TrendingItem = import("@/types/trending").TrendingItem;

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string }>;
}) {
  const { tab, q } = await searchParams as { tab?: string; q?: string };
  const pageSize = 10;
  // Auth resolved lazily so the shell heading/tabs render instantly.
  const supabasePromise = createClient();

  return (
    <ListPageShell
      title="Research Feed"
      description="Short research updates from the community."
      tab={tab}
      enableTrending={true}
      allHref="/feed"
      trendingHref="/feed?tab=trending"
      trending={
        <AsyncListRegion
          fetcher={async () => {
            const supabase = await supabasePromise;
            const { data: { user } } = await supabase.auth.getUser();
            const items = (await getTrendingSocialPosts().catch(
              () => [],
            )) as unknown as TrendingItem[];
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
            const { data: { user } } = await supabase.auth.getUser();
            const posts = await getFeed(user?.id, tab, q, pageSize);
            return { posts, userId: user?.id };
          }}
        >
          {({ posts, userId }) => (
            <>
              <CreateSocialPostFormWrapper />
              <FeedList
                posts={posts}
                currentUserId={userId}
                initialQuery={q ?? ""}
                loadMoreParams={{ q, tab }}
              />
            </>
          )}
        </AsyncListRegion>
      }
    />
  );
}
