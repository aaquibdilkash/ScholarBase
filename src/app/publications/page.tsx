import { createClient } from "@/utils/supabase/server";
import ListPageShell from "@/components/layout/ListPageShell";
import { getPublications } from "../actions/publications";
import { PublicationsList } from "@/components/publications/PublicationsList";
import { getTrendingPublications } from "@/lib/trending";
import { TrendingList } from "@/components/feed/TrendingList";

export default async function PublicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tab?: string }>;
}) {
  const { q, tab } = await searchParams;
  const isTrendingTab = tab === "trending";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const publications = isTrendingTab ? [] : await getPublications(q, user?.id);

  const trendingItems = isTrendingTab
    ? await getTrendingPublications()
    : [];

  const typedTrendingItems =
    trendingItems as import("@/types/trending").TrendingItem[];

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
        <TrendingList
          items={typedTrendingItems}
          currentUserId={user?.id ?? ""}
        />
      }
      all={
        <PublicationsList
          publications={publications}
          currentUserId={user?.id}
          initialQuery={q ?? ""}
        />
      }
    />
  );
}
