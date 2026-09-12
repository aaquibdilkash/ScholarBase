import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "PhD Admissions - ScholarBase",
  description:
    "Find and share PhD admission notifications from universities and research institutions worldwide.",
  path: "/admissions",
  section: "PhD Admissions",
});
import { createClient } from "@/utils/supabase/server";
import ListPageShell from "@/components/layout/ListPageShell";
import { AdmissionsList } from "@/components/admissions/AdmissionsList";
import { getTrendingAdmissions } from "@/lib/trending";
import { TrendingList } from "@/components/feed/TrendingList";
import { getAdmissions } from "@/app/actions/admissions";
import { AsyncListRegion } from "@/components/cards/AsyncListRegion";

type TrendingItem = import("@/types/trending").TrendingItem;

export default async function AdmissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tab?: string }>;
}) {
  const { q, tab } = await searchParams;
  // Auth is resolved lazily (no top-level await) so the ListPageShell
  // heading/tabs render instantly while the AsyncListRegion fetchers suspend.
  const supabasePromise = createClient();

  return (
    <ListPageShell
      title="PhD Admissions"
      description="Admissions and seat notifications from universities."
      addHref="/admissions/add"
      addLabel="+ Post Admission"
      tab={tab}
      enableTrending={true}
      allHref="/admissions"
      trendingHref="/admissions?tab=trending"
      trending={
        <AsyncListRegion
          fetcher={async () => {
            const supabase = await supabasePromise;
            const { data: { user } } = await supabase.auth.getUser();
            const items = (await getTrendingAdmissions()) as unknown as TrendingItem[];
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
            const admissions = await getAdmissions(q ?? "", user?.id, 10);
            return { admissions, userId: user?.id };
          }}
        >
          {({ admissions, userId }) => (
            <AdmissionsList
              admissions={admissions}
              currentUserId={userId}
              initialQuery={q ?? ""}
            />
          )}
        </AsyncListRegion>
      }
    />
  );
}
