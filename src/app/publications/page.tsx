import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";
import { SEO_PAGES, LIST_PAGE_TEXT } from "@/constants/seo";

export const metadata: Metadata = buildMetadata({
  title: SEO_PAGES.publications.title,
  description: SEO_PAGES.publications.description,
  path: SEO_PAGES.publications.path,
  section: SEO_PAGES.publications.section,
});
import { createClient } from "@/utils/supabase/server";
import ListPageShell from "@/components/layout/ListPageShell";
import { getPublications } from "../actions/publications";
import { PublicationsList } from "@/components/publications/PublicationsList";
import { getTrendingPublications } from "@/lib/trending";
import { TrendingList } from "@/components/feed/TrendingList";
import { AsyncListRegion } from "@/components/cards/AsyncListRegion";

type TrendingItem = import("@/types/trending").TrendingItem;

export default async function PublicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tab?: string }>;
}) {
  const { q, tab } = await searchParams;
  const supabasePromise = createClient();

  return (
    <ListPageShell
      title={LIST_PAGE_TEXT.publications.title}
      description={LIST_PAGE_TEXT.publications.description}
      addHref="/publications/add"
      addLabel="+ Add Publication"
      tab={tab}
      enableTrending={true}
      allHref="/publications"
      trendingHref="/publications?tab=trending"
      trending={
        <AsyncListRegion
          fetcher={async () => {
            const supabase = await supabasePromise;
            const {
              data: { user },
            } = await supabase.auth.getUser();
            const items =
              (await getTrendingPublications()) as unknown as TrendingItem[];
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
            const publications = await getPublications(q ?? "", 10);
            return { publications, userId: user?.id };
          }}
        >
          {({ publications, userId }) => (
            <PublicationsList
              publications={publications}
              currentUserId={userId}
              initialQuery={q ?? ""}
            />
          )}
        </AsyncListRegion>
      }
    />
  );
}
