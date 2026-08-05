import type { Metadata } from "next";
import EventForm from "@/components/events/EventForm";
import CreateOrEditPageShell from "@/components/layout/CreateOrEditPageShell";

export const metadata: Metadata = {
  title: "List a Research Event / Conference",
  description:
    "Add conferences, calls for papers, and academic events that matter to researchers.",
  robots: { index: false, follow: true },
};

export default function NewEventPage() {
  return (
    <CreateOrEditPageShell
      title="List a Research Event / Conference"
      description="Add conferences, calls, and events that matter to researchers."
      backHref="/events"
      backLabel="← Back to Events"
    >
      <EventForm mode="create" />
    </CreateOrEditPageShell>
  );
}
