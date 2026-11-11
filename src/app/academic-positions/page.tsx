import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";
import { SEO_PAGES, LIST_PAGE_TEXT } from "@/constants/seo";

export const metadata: Metadata = buildMetadata({
  title: SEO_PAGES.academicPositions.title,
  description: SEO_PAGES.academicPositions.description,
  path: SEO_PAGES.academicPositions.path,
  section: SEO_PAGES.academicPositions.section,
});
import { createClient } from "@/utils/supabase/server";
import ListPageShell from "@/components/layout/ListPageShell";
import { AcademicPositionsList } from "@/components/academic-positions/AcademicPositionsList";
import { getTrendingAcademicPositions } from "@/lib/trending";
import { TrendingList } from "@/components/feed/TrendingList";
import { getAcademicPositions } from "@/app/actions/academic-positions";
import { AsyncListRegion } from "@/components/cards/AsyncListRegion";

type TrendingItem = import("@/types/trending").TrendingItem;

export default async function AcademicPositionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tab?: string }>;
}) {
  const { q, tab } = await searchParams;
  const supabasePromise = createClient();

  return (
    <ListPageShell
      title={LIST_PAGE_TEXT.academicPositions.title}
      description={LIST_PAGE_TEXT.academicPositions.description}
      addHref="/academic-positions/add"
      addLabel="+ Post Position"
      tab={tab}
      enableTrending={true}
      allHref="/academic-positions"
      trendingHref="/academic-positions?tab=trending"
      trending={
        <AsyncListRegion
          fetcher={async () => {
            const supabase = await supabasePromise;
            const {
              data: { user },
            } = await supabase.auth.getUser();
            const items =
              (await getTrendingAcademicPositions()) as unknown as TrendingItem[];
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
            const positions = await getAcademicPositions(q ?? "", 10);
            return { positions, userId: user?.id };
          }}
        >
          {({ positions, userId }) => (
            <AcademicPositionsList
              positions={positions}
              currentUserId={userId}
              initialQuery={q ?? ""}
            />
          )}
        </AsyncListRegion>
      }
    />
  );
}
