import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Research Blog - Insights, Guides & Essays",
  description: "Essays, guides, and longer-form research reflections on academia, publishing, and scholarly life.",
  path: "/blog",
  section: "Blog",
});
import ListPageShell from "@/components/layout/ListPageShell";
import { getTrendingArticles } from "@/lib/trending";
import { TrendingList } from "@/components/feed/TrendingList";
import { createClient } from "@/utils/supabase/server";
import { ArticleList } from "@/components/blog/ArticleList";
import { getArticles } from "@/app/actions/blog";
import { AsyncListRegion } from "@/components/cards/AsyncListRegion";

type TrendingItem = import("@/types/trending").TrendingItem;

export default async function BlogIndex({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string }>;
}) {
  const { tab, q } = await searchParams;
  const supabasePromise = createClient();

  return (
    <ListPageShell
      title="Research Blog"
      description="Essays, notes, and longer-form research reflections."
      addHref="/blog/add"
      addLabel="+ New Article"
      tab={tab}
      enableTrending={true}
      allHref="/blog"
      trendingHref="/blog?tab=trending"
      trending={
        <AsyncListRegion
          fetcher={async () => {
            const supabase = await supabasePromise;
            const { data: { user } } = await supabase.auth.getUser();
            const items = (await getTrendingArticles()) as unknown as TrendingItem[];
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
            const articles = await getArticles(q ?? "", user?.id, 10);
            return { articles, userId: user?.id };
          }}
        >
          {({ articles, userId }) => (
            <ArticleList
              articles={articles}
              currentUserId={userId}
              initialQuery={q ?? ""}
            />
          )}
        </AsyncListRegion>
      }
    />
  );
}
