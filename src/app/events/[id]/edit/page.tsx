import prisma from "@/lib/db";
import { notFound } from "next/navigation";
import { requireCurrentUser } from "@/lib/auth";
import EventForm from "@/components/events/EventForm";
import CreateOrEditPageShell from "@/components/layout/CreateOrEditPageShell";

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
  const event = await prisma.researchEvent.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      date: true,
      location: true,
      description: true,
      deadline: true,
      notificationLink: true,
      applyLink: true,
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
      title="Edit Research Event"
      description="Update the conference dates, links, or description."
      backHref={`/events/${event.id}`}
      backLabel="← Cancel and Back to Event"
    >
      <EventForm
        mode="edit"
        eventId={event.id}
        initialValues={{
          title: event.title,
          date: new Date(event.date).toISOString().slice(0, 10),
          location: event.location,
          description: event.description,
          deadline: event.deadline
            ? new Date(event.deadline).toISOString().slice(0, 10)
            : "",
          notificationLink: event.notificationLink ?? "",
          applyLink: event.applyLink ?? "",
        }}
      />
    </CreateOrEditPageShell>
  );
}
