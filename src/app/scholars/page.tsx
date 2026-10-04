import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";
import { SEO_PAGES, LIST_PAGE_TEXT } from "@/constants/seo";

export const metadata: Metadata = buildMetadata({
  title: SEO_PAGES.scholars.title,
  description: SEO_PAGES.scholars.description,
  path: SEO_PAGES.scholars.path,
  section: SEO_PAGES.scholars.section,
});
import ListPageShell from "@/components/layout/ListPageShell";
import { getCurrentUser } from "@/lib/auth";
import { getScholars } from "@/app/actions/scholars";
import { ScholarsList } from "@/components/scholars/ScholarsList";
import { getTrendingScholars } from "@/lib/trending";
import { TrendingList } from "@/components/feed/TrendingList";
import { ShareButton } from "@/components/interactions/ShareButton";
import { AsyncListRegion } from "@/components/cards/AsyncListRegion";

export default async function ScholarsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tab?: string; sort?: string }>;
}) {
  const { q, tab, sort } = (await searchParams) as {
    q?: string;
    tab?: string;
    sort?: string;
  };
  const pageSize = 10;
  // Auth resolved lazily so the shell heading/tabs render instantly while the
  // list region suspends via AsyncListRegion.
  const userPromise = getCurrentUser();

  return (
    <ListPageShell
      title={LIST_PAGE_TEXT.scholars.title}
      description={LIST_PAGE_TEXT.scholars.description}
      addAction={
        <ShareButton
          href="/"
          label="Share ScholarBase"
          variant="primary"
          copySuccessMessage="ScholarBase link copied"
        />
      }
      tab={tab}
      enableTrending={true}
      allHref="/scholars"
      trendingHref="/scholars?tab=trending"
      trending={
        <AsyncListRegion
          fetcher={async () => {
            const currentUser = await userPromise;
            const items =
              (await getTrendingScholars()) as unknown as import("@/types/trending").TrendingItem[];
            return { items, userId: currentUser?.id };
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
            const currentUser = await userPromise;
            // Viewer identity is resolved inside the action; the page does not
            // pass a userId down to the data layer.
            const scholars = await getScholars(
              q,
              sort === "reputation" ? "reputation" : "latest",
              pageSize,
            );
            return { scholars, userId: currentUser?.id };
          }}
        >
          {({ scholars, userId }) => (
            <ScholarsList
              scholars={scholars}
              currentUserId={userId ?? ""}
              initialQuery={q ?? ""}
              loadMoreParams={{ q, sort }}
            />
          )}
        </AsyncListRegion>
      }
    />
  );
}
