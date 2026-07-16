import Link from "next/link";
import EventForm from "@/app/events/components/EventForm";

export default function NewEventPage() {
  return (
    <main className="mx-auto max-w-4xl py-6">
      <div className="mb-8">
        <Link
          href="/events"
          className="mb-6 inline-flex items-center text-sm font-medium text-slate-500 transition-colors hover:text-blue-700"
        >
          ← Back to Events
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
          List a Research Event / Conference
        </h1>
        <p className="mt-2 text-slate-600">
          Add conferences, calls, and events that matter to researchers.
        </p>
      </div>

      <EventForm mode="create" />
    </main>
  );
}

