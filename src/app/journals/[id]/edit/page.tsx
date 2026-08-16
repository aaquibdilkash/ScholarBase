import type { Metadata } from "next";
import { buildNoindexMetadata } from "@/lib/seo";

export const metadata: Metadata = buildNoindexMetadata("Edit Journal - ScholarBase");
import prisma from "@/lib/db";
import { notFound } from "next/navigation";
import { requireCurrentUser } from "@/lib/auth";
import JournalForm from "@/components/journals/JournalForm";
import CreateOrEditPageShell from "@/components/layout/CreateOrEditPageShell";

export default async function EditJournalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireCurrentUser(
    "You must be logged in to edit this journal.",
  );

  // Fetch only the raw field data required to populate the form inputs
  const journal = await prisma.journal.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      issn: true,
      impactFactor: true,
      scopus: true,
      abdcCategory: true,
      publisher: true,
      website: true,
      about: true,
      authorId: true,
    },
  });

  if (!journal) {
    notFound();
  }

  // Security Guard: Ensure the current user owns this journal
  if (journal.authorId !== user.id) {
    throw new Error("You are not authorized to edit this journal.");
  }

  return (
    <CreateOrEditPageShell
      title="Edit Journal Details"
      description="Update metrics, descriptions, or links for this journal."
      backHref={`/journals/${journal.id}`}
      backLabel="← Cancel and Back to Journal"
    >
      <JournalForm
        mode="edit"
        journalId={journal.id}
        initialValues={{
          title: journal.title,
          issn: journal.issn ?? "",
          impactFactor: journal.impactFactor?.toString() ?? "",
          scopus: journal.scopus ?? "",
          abdcCategory: journal.abdcCategory ?? "",
          publisher: journal.publisher ?? "",
          website: journal.website ?? "",
          about: journal.about ?? "",
        }}
      />
    </CreateOrEditPageShell>
  );
}
