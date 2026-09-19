import type { Metadata } from "next";
import { buildNoindexMetadata } from "@/lib/seo";

export const metadata: Metadata = buildNoindexMetadata(
  "Add Journal Review - ScholarBase",
);
import { notFound } from "next/navigation";
import prisma from "@/lib/db";
import JournalReviewForm from "@/components/journals/JournalReviewForm";
import CreateOrEditPageShell from "@/components/layout/CreateOrEditPageShell";

export default async function AddJournalReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // No server-side login gate: logged-out scholars can open the form and the
  // SubmitBtnWithAuth button opens the AuthModal on submit (mirrors the
  // supervisor recommendation flow).
  const { id } = await params;

  const journal = await prisma.journal.findUnique({
    where: { id, isDeleted: false },
    select: { title: true },
  });

  if (!journal) notFound();

  return (
    <CreateOrEditPageShell
      title={`Review ${journal.title}`}
      description={`Share your experience submitting, publishing, or reviewing for ${journal.title} to help fellow scholars choose wisely.`}
      backHref={`/journals/${id}`}
      backLabel="Cancel"
      maxWidth="sm"
    >
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200/60 p-8 md:p-10 dark:bg-slate-900 dark:border-slate-800">
        <JournalReviewForm mode="create" journalId={id} />
      </div>
    </CreateOrEditPageShell>
  );
}
