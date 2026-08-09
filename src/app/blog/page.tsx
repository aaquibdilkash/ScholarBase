import ListPageShell from "@/components/layout/ListPageShell";
import { getTrendingArticles } from "@/lib/trending";
import { TrendingList } from "@/components/feed/TrendingList";
import { createClient } from "@/utils/supabase/server";
import { ArticleList } from "@/components/blog/ArticleList";
import { getArticles } from "@/app/actions/blog";

export default async function BlogIndex({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string }>;
}) {
  const { tab, q } = await searchParams;

  const isTrendingTab = tab === "trending";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const articles = isTrendingTab ? [] : await getArticles(q, user?.id);

  const trendingItems = (isTrendingTab
    ? await getTrendingArticles()
    : []) as unknown as import("@/types/trending").TrendingItem[];

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
      trending={<TrendingList items={trendingItems} currentUserId={user?.id} />}
      all={
        <ArticleList
          articles={articles}
          currentUserId={user?.id}
          initialQuery={q ?? ""}
        />
      }
    />
  );
}
