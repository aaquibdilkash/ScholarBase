import { createClient } from "@/utils/supabase/server";
import { Metadata } from "next";
import ListPageShell from "@/components/layout/ListPageShell";
import { AdmissionsList } from "@/components/admissions/AdmissionsList";
import { getTrendingAdmissions } from "@/lib/trending";
import { TrendingList } from "@/components/feed/TrendingList";
import { TrendingItem } from "@/types/trending";
import { getAdmissions } from "@/app/actions/admissions";

export const metadata: Metadata = {
  title: "PhD Admissions - ScholarBase",
  description:
    "Find and share PhD admission notifications from universities and research institutions worldwide.",
};

export default async function AdmissionsPage({
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

  const admissions = isTrendingTab ? [] : await getAdmissions(q, user?.id);

  const trendingItems = (isTrendingTab
    ? await getTrendingAdmissions(user?.id)
    : []) as unknown as import("@/types/trending").TrendingItem[];

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
        <TrendingList
          items={trendingItems as TrendingItem[]}
          currentUserId={user?.id}
        />
      }
      all={
        <AdmissionsList
          admissions={admissions}
          currentUserId={user?.id}
          initialQuery={q ?? ""}
        />
      }
    />
  );
}
