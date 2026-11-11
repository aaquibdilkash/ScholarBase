import type { Metadata } from "next";
import { buildNoindexMetadata } from "@/lib/seo";

export const metadata: Metadata = buildNoindexMetadata(
  "Edit Call for Papers - ScholarBase",
);
import prisma from "@/lib/db";
import { notFound } from "next/navigation";
import { requireCurrentUser } from "@/lib/auth";
import CallForPaperForm from "@/components/call-for-papers/CallForPaperForm";
import CreateOrEditPageShell from "@/components/layout/CreateOrEditPageShell";
import { EDIT_PAGE_TEXT } from "@/constants/seo";
import { stripMailtoPrefix } from "@/lib/email-normalizer";

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireCurrentUser(
    "You must be logged in to edit this event.",
  );

  // Fetch only the raw field data required to populate the form inputs
  const event = await prisma.callForPaper.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      eventDate: true,
      category: true,
      location: true,
      description: true,
      deadline: true,
      notificationLink: true,
      applyLink: true,
      publisher: true,
      journalId: true,
      journal: { select: { id: true, title: true } },
      authorId: true,
    },
  });

  if (!event) {
    notFound();
  }

  // Security Guard: Ensure the current user owns this event
  if (event.authorId !== user.id) {
    throw new Error("You are not authorized to edit this event.");
  }

  return (
    <CreateOrEditPageShell
      title={EDIT_PAGE_TEXT.callForPapers.title}
      description={EDIT_PAGE_TEXT.callForPapers.description}
      backHref={`/call-for-papers/${event.id}`}
      backLabel="Cancel and Back to Call for Papers"
    >
      <CallForPaperForm
        mode="edit"
        eventId={event.id}
        initialValues={{
          title: event.title,
          category: event.category,
          publisher: event.publisher ?? "",
          journalId: event.journalId ?? "",
          journal: event.journal?.title ?? "",
          eventDate: event.eventDate
            ? new Date(event.eventDate).toISOString().slice(0, 10)
            : "",
          location: event.location ?? "",
          description: event.description,
          deadline: event.deadline
            ? new Date(event.deadline).toISOString().slice(0, 10)
            : "",
          notificationLink: event.notificationLink ?? "",
          // Mirror vacancies: prefill the bare email so the user never
          // sees/edits `mailto:` text.
          applyLink: event.applyLink ? stripMailtoPrefix(event.applyLink) : "",
        }}
      />
    </CreateOrEditPageShell>
  );
}
