import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Academic Journals Database - ISSN, Impact Factor & More",
  description:
    "Browse and discover academic journals, ISSN, impact factors, Scopus indexing, and publisher information.",
  path: "/journals",
  section: "Journals",
});
import { createClient } from "@/utils/supabase/server";

import ListPageShell from "@/components/layout/ListPageShell";
import { JournalsList } from "@/components/journals/JournalsList";
import { getTrendingJournals } from "@/lib/trending";
import { TrendingList } from "@/components/feed/TrendingList";
import { getJournals } from "@/app/actions/journals";
import { AsyncListRegion } from "@/components/cards/AsyncListRegion";

type TrendingItem = import("@/types/trending").TrendingItem;

export default async function JournalsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tab?: string }>;
}) {
  const { q, tab } = await searchParams;
  const supabasePromise = createClient();

  return (
    <ListPageShell
      title="Journals"
      description="Browse and discover academic journals."
      addHref="/journals/add"
      addLabel="+ Add Journal"
      tab={tab}
      enableTrending={true}
      allHref="/journals"
      trendingHref="/journals?tab=trending"
      trending={
        <AsyncListRegion
          fetcher={async () => {
            const supabase = await supabasePromise;
            const { data: { user } } = await supabase.auth.getUser();
            const items = (await getTrendingJournals()) as unknown as TrendingItem[];
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
            const journals = await getJournals(q ?? "", user?.id, 10);
            return { journals, userId: user?.id };
          }}
        >
          {({ journals, userId }) => (
            <JournalsList
              journals={journals}
              currentUserId={userId}
              initialQuery={q ?? ""}
            />
          )}
        </AsyncListRegion>
      }
    />
  );
}
