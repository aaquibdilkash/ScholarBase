import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";
import { SEO_PAGES, LIST_PAGE_TEXT } from "@/constants/seo";

export const metadata: Metadata = buildMetadata({
  title: SEO_PAGES.contributions.title,
  description: SEO_PAGES.contributions.description,
  path: SEO_PAGES.contributions.path,
  section: SEO_PAGES.contributions.section,
});
import { createClient } from "@/utils/supabase/server";
import ListPageShell from "@/components/layout/ListPageShell";
import { ContributionsList } from "@/components/contributions/ContributionsList";
import { getTrendingContributions } from "@/lib/trending";
import { TrendingList } from "@/components/feed/TrendingList";
import { getContributions } from "@/app/actions/contributions";
import { AsyncListRegion } from "@/components/cards/AsyncListRegion";
import { ComingSoon } from "@/components/contributions/ComingSoon";
import { isComingSoon } from "@/lib/feature-flags";

type TrendingItem = import("@/types/trending").TrendingItem;

export default async function ContributionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tab?: string }>;
}) {
  if (isComingSoon) {
    return <ComingSoon />;
  }

  const { q, tab } = await searchParams;
  const supabasePromise = createClient();

  return (
    <ListPageShell
      title={LIST_PAGE_TEXT.contributions.title}
      description={LIST_PAGE_TEXT.contributions.description}
      addHref="/contributions/add"
      addLabel="+ Add Contribution"
      tab={tab}
      enableTrending={true}
      allHref="/contributions"
      trendingHref="/contributions?tab=trending"
      trending={
        <AsyncListRegion
          fetcher={async () => {
            const supabase = await supabasePromise;
            const {
              data: { user },
            } = await supabase.auth.getUser();
            const items =
              (await getTrendingContributions()) as unknown as TrendingItem[];
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
            const contributions = await getContributions(q ?? "", 10);
            return { contributions, userId: user?.id };
          }}
        >
          {({ contributions, userId }) => (
            <ContributionsList
              contributions={contributions}
              initialQuery={q ?? ""}
              currentUserId={userId}
            />
          )}
        </AsyncListRegion>
      }
    />
  );
}
