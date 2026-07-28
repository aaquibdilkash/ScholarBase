import prisma from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { requireCurrentUser } from "@/lib/auth";
import PublicationForm from "@/components/publications/PublicationForm";

export default async function EditPublicationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireCurrentUser(
    "You must be logged in to edit this publication.",
  );

  const publication = await prisma.publication.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      authors: true,
      publicationType: true,
      journalOrConference: true,
      publisher: true,
      year: true,
      volume: true,
      issue: true,
      pages: true,
      doi: true,
      isbn: true,
      url: true,
      keywords: true,
      domain: true,
      abstract: true,
      isUserAuthor: true,
      authorId: true,
    },
  });

  if (!publication) {
    notFound();
  }

  if (publication.authorId !== user.id) {
    throw new Error("You are not authorized to edit this publication.");
  }

  return (
    <main className="mx-auto max-w-4xl py-6 px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <Link
          href={`/publications/${publication.id}`}
          className="mb-6 inline-flex items-center text-sm font-medium text-slate-500 transition-colors hover:text-blue-700"
        >
          ← Cancel and Back to Publication
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
          Edit Publication
        </h1>
        <p className="mt-2 text-slate-600">
          Update the publication details, metadata, or abstract.
        </p>
      </div>

      <PublicationForm
        mode="edit"
        publicationId={publication.id}
        initialValues={{
          title: publication.title,
          authors: publication.authors,
          publicationType: publication.publicationType,
          journalOrConference: publication.journalOrConference ?? "",
          publisher: publication.publisher ?? "",
          year: publication.year?.toString() ?? "",
          volume: publication.volume ?? "",
          issue: publication.issue ?? "",
          pages: publication.pages ?? "",
          doi: publication.doi ?? "",
          isbn: publication.isbn ?? "",
          url: publication.url ?? "",
          keywords: publication.keywords ?? "",
          domain: publication.domain ?? "",
          abstract: publication.abstract ?? "",
          isUserAuthor: publication.isUserAuthor ? "true" : "false",
        }}
      />
    </main>
  );
}
