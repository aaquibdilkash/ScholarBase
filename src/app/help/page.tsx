import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Scholar Suggest - ScholarBase",
  description:
    "Share suggestions, bug reports, or new feature request for ScholarBase with the community.",
  path: "/help",
  section: "Help & Support",
});
import { createClient } from "@/utils/supabase/server";
import ListPageShell from "@/components/layout/ListPageShell";
import { HelpPostList } from "@/components/help/HelpPostList";
import { getTrendingHelpPosts } from "@/lib/trending";
import { TrendingList } from "@/components/feed/TrendingList";
import { getHelpPosts } from "@/app/actions/help";
import { AsyncListRegion } from "@/components/cards/AsyncListRegion";

type TrendingItem = import("@/types/trending").TrendingItem;

export default async function HelpPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tab?: string }>;
}) {
  const { q, tab } = await searchParams;
  const supabasePromise = createClient();

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
      trending={
        <AsyncListRegion
          fetcher={async () => {
            const supabase = await supabasePromise;
            const { data: { user } } = await supabase.auth.getUser();
            const items = (await getTrendingHelpPosts()) as unknown as TrendingItem[];
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
            const posts = await getHelpPosts(q ?? "", user?.id, 10);
            return { posts, userId: user?.id };
          }}
        >
          {({ posts, userId }) => (
            <HelpPostList
              posts={posts}
              currentUserId={userId}
              initialQuery={q ?? ""}
            />
          )}
        </AsyncListRegion>
      }
    />
  );
}
