import type { Metadata } from "next";
import EventForm from "@/components/events/EventForm";
import CreateOrEditPageShell from "@/components/layout/CreateOrEditPageShell";
import { SEO_CREATE_PAGES } from "@/constants/seo";

export const metadata: Metadata = {
  title: SEO_CREATE_PAGES.events.title,
  description: SEO_CREATE_PAGES.events.description,
  robots: { index: true, follow: true },
};

export default function NewEventPage() {
  return (
    <CreateOrEditPageShell
      title={SEO_CREATE_PAGES.events.title}
      description={SEO_CREATE_PAGES.events.description}
      backHref="/events"
      backLabel="Back to Events"
    >
      <EventForm mode="create" />
    </CreateOrEditPageShell>
  );
}
