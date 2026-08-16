import type { Metadata } from "next";
import ListPageShell from "@/components/layout/ListPageShell";
import { createClient } from "@/utils/supabase/server";
import { getResearchGrants } from "@/app/actions/grants";
import { ResearchGrantsList } from "@/components/grants/ResearchGrantsList";

export const metadata: Metadata = {
  title: "Research Grants",
  description: "Discover and share research grants, funding calls, application links, and guidance for scholars.",
  alternates: { canonical: "/grants" },
};

export default async function ResearchGrantsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams as { q?: string };
  const pageSize = 10;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const grants = await getResearchGrants(q, user?.id, pageSize);

  return (
    <ListPageShell
      title="Research Grants"
      description="Share funding opportunities, application guidance, and useful grant information with scholars."
      addHref="/grants/add"
      addLabel="+ Add Research Grant"
      enableTrending={false}
      allHref="/grants"
      trending={null}
      all={
        <ResearchGrantsList
          grants={grants}
          currentUserId={user?.id}
          initialQuery={q ?? ""}
          loadMoreParams={q ? { q } : undefined}
        />
      }
    />
  );
}
