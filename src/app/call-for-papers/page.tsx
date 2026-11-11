import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";
import { SEO_PAGES, LIST_PAGE_TEXT } from "@/constants/seo";

export const metadata: Metadata = buildMetadata({
  title: SEO_PAGES.callForPapers.title,
  description: SEO_PAGES.callForPapers.description,
  path: SEO_PAGES.callForPapers.path,
  section: SEO_PAGES.callForPapers.section,
});
import { createClient } from "@/utils/supabase/server";
import ListPageShell from "@/components/layout/ListPageShell";
import { CallForPapersList } from "@/components/call-for-papers/CallForPapersList";
import { getTrendingCallForPapers } from "@/lib/trending";
import { TrendingList } from "@/components/feed/TrendingList";
import { getCallForPapers } from "@/app/actions/call-for-papers";
import { AsyncListRegion } from "@/components/cards/AsyncListRegion";

type TrendingItem = import("@/types/trending").TrendingItem;

export default async function CallForPapersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tab?: string }>;
}) {
  const { q, tab } = await searchParams;
  // Auth is resolved lazily (no top-level await) so the shell heading/tabs
  // render instantly while the AsyncListRegion fetchers suspend as needed.
  const supabasePromise = createClient();

  return (
    <ListPageShell
      title={LIST_PAGE_TEXT.callForPapers.title}
      description={LIST_PAGE_TEXT.callForPapers.description}
      addHref="/call-for-papers/add"
      addLabel="+ Add Call for Papers"
      tab={tab}
      enableTrending={true}
      allHref="/call-for-papers"
      trendingHref="/call-for-papers?tab=trending"
      trending={
        <AsyncListRegion
          fetcher={async () => {
            const supabase = await supabasePromise;
            const {
              data: { user },
            } = await supabase.auth.getUser();
            const items =
              (await getTrendingCallForPapers()) as unknown as TrendingItem[];
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
            const callForPapers = await getCallForPapers(q ?? "", 10);
            return { callForPapers, userId: user?.id };
          }}
        >
          {({ callForPapers, userId }) => (
            <CallForPapersList
              callForPapers={callForPapers}
              currentUserId={userId}
              initialQuery={q ?? ""}
            />
          )}
        </AsyncListRegion>
      }
    />
  );
}
