import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Publications - Research Papers, Conference Proceedings & Books",
  description: "Browse and discover academic publications — research papers, conference proceedings, preprints, books, and more.",
  path: "/publications",
  section: "Publications",
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
      title="Publications"
      description="Browse and discover academic publications — research papers, conference proceedings, books, and more."
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
            const { data: { user } } = await supabase.auth.getUser();
            const items = (await getTrendingPublications()) as unknown as TrendingItem[];
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
            const publications = await getPublications(q ?? "", user?.id, 10);
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
