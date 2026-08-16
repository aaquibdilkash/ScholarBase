import type { Metadata } from "next";
import { buildNoindexMetadata } from "@/lib/seo";

export const metadata: Metadata = buildNoindexMetadata("Add Recommendation - ScholarBase");
import prisma from "@/lib/db";
import RecommendationForm from "@/components/supervisor/RecommendationForm";
import CreateOrEditPageShell from "@/components/layout/CreateOrEditPageShell";

export default async function RecommendSupervisorNew({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supervisor = await prisma.supervisor.findUnique({
    where: { id },
    select: { name: true },
  });

  return (
    <CreateOrEditPageShell
      title={`Recommend ${supervisor?.name}`}
      description={`Help fellow scholars by sharing your positive mentorship experience with ${supervisor?.name}.`}
      backHref={`/supervisor/${id}`}
      backLabel="← Cancel"
      maxWidth="sm"
    >
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200/60 p-8 md:p-10 dark:bg-slate-900 dark:border-slate-800">
        <RecommendationForm mode="create" supervisorId={id} />
      </div>
    </CreateOrEditPageShell>
  );
}
