import Link from "next/link";
import prisma from "@/lib/db";

export default async function EventsPage() {
  const events = await prisma.researchEvent.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="mx-auto max-w-6xl py-6">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
            Research Events & Conferences
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Conferences, calls, and academic gatherings worth tracking.
          </p>
        </div>
        <Link href="/events/new" className="sb-button-accent whitespace-nowrap">
          + Add Event
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {events.map((event) => (
          <div
            key={event.id}
            className="sb-card sb-card-hover group flex flex-col"
          >
            <div className="mb-4">
              <span className="inline-flex rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold tracking-wide text-blue-700">
                {event.location}
              </span>
            </div>

            <h2 className="mb-2 text-xl font-semibold leading-tight text-slate-950">
              {event.title}
            </h2>
            <p className="mb-4 text-sm font-medium text-slate-600">
              Event Date:{" "}
              {new Date(event.date).toLocaleDateString(undefined, {
                dateStyle: "medium",
              })}
            </p>

            <p className="mb-6 text-sm leading-relaxed text-slate-600 line-clamp-3">
              {event.description}
            </p>

            <div className="mt-auto border-t border-slate-100 pt-5">
              {event.deadline && (
                <div className="mb-5 flex items-center gap-2 rounded-2xl border border-red-100/50 bg-red-50/50 p-3 text-sm font-semibold text-red-600">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    ></path>
                  </svg>
                  Deadline: {new Date(event.deadline).toLocaleDateString()}
                </div>
              )}

              <div className="flex gap-3">
                {event.notificationLink && (
                  <a
                    href={event.notificationLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 rounded-2xl bg-slate-100 py-2.5 text-center text-sm font-semibold text-slate-700 transition-colors duration-200 hover:bg-slate-200"
                  >
                    Brochure
                  </a>
                )}

                {event.applyLink && (
                  <a
                    href={event.applyLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 rounded-2xl bg-slate-950 py-2.5 text-center text-sm font-semibold text-white transition-colors duration-200 hover:bg-slate-800"
                  >
                    Submit
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
