import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";
import { SEO_PAGES, LIST_PAGE_TEXT } from "@/constants/seo";

export const metadata: Metadata = buildMetadata({
  title: SEO_PAGES.blog.title,
  description: SEO_PAGES.blog.description,
  path: SEO_PAGES.blog.path,
  section: SEO_PAGES.blog.section,
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
      title={LIST_PAGE_TEXT.blog.title}
      description={LIST_PAGE_TEXT.blog.description}
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
            const {
              data: { user },
            } = await supabase.auth.getUser();
            const items =
              (await getTrendingArticles()) as unknown as TrendingItem[];
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
            const {
              data: { user },
            } = await supabase.auth.getUser();
            // Viewer identity is resolved inside the action; the page does not
            // pass a userId down to the data layer.
            const articles = await getArticles(q ?? "", 10);
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
