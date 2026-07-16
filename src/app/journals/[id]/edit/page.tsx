import prisma from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { requireCurrentUser } from "@/lib/auth";
import JournalForm from "@/app/journals/components/JournalForm";

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
    <main className="mx-auto max-w-4xl py-6 px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <Link
          href={`/journals/${journal.id}`}
          className="mb-6 inline-flex items-center text-sm font-medium text-slate-500 transition-colors hover:text-blue-700"
        >
          ← Cancel and Back to Journal
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
          Edit Journal Details
        </h1>
        <p className="mt-2 text-slate-600">
          Update metrics, descriptions, or links for this journal.
        </p>
      </div>

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
    </main>
  );
}
