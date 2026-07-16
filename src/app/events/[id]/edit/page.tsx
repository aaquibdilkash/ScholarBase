import prisma from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { requireCurrentUser } from "@/lib/auth";
import EventForm from "@/app/events/components/EventForm";

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireCurrentUser("You must be logged in to edit this event.");

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
    <main className="mx-auto max-w-4xl py-6 px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <Link
          href={`/events/${event.id}`}
          className="mb-6 inline-flex items-center text-sm font-medium text-slate-500 transition-colors hover:text-blue-700"
        >
          ← Cancel and Back to Event
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
          Edit Research Event
        </h1>
        <p className="mt-2 text-slate-600">
          Update the conference dates, links, or description.
        </p>
      </div>

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
    </main>
  );
}