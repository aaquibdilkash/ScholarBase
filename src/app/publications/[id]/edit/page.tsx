import prisma from "@/lib/db";
import { notFound } from "next/navigation";
import { requireCurrentUser } from "@/lib/auth";
import PublicationForm from "@/components/publications/PublicationForm";
import CreateOrEditPageShell from "@/components/layout/CreateOrEditPageShell";

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
    <CreateOrEditPageShell
      title="Edit Publication"
      description="Update the publication details, metadata, or abstract."
      backHref={`/publications/${publication.id}`}
      backLabel="← Cancel and Back to Publication"
    >
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
    </CreateOrEditPageShell>
  );
}
