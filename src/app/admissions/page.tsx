import Link from "next/link";
import prisma from "@/lib/db";

export default async function AdmissionsPage() {
  const admissions = await prisma.phdAdmission.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="mx-auto max-w-6xl py-6">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
            PhD Admissions
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Admissions and seat notifications from universities.
          </p>
        </div>
        <Link
          href="/admissions/new"
          className="sb-button-accent whitespace-nowrap"
        >
          + Post Admission
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {admissions.map((item) => (
          <div
            key={item.id}
            className="sb-card sb-card-hover group flex flex-col"
          >
            <div className="mb-4">
              <h2 className="text-xl font-semibold leading-tight text-slate-950">
                {item.university}
              </h2>
              <p className="mt-1 text-sm font-semibold text-blue-700">
                {item.department}
              </p>
            </div>

            <p className="mb-6 text-sm leading-relaxed text-slate-600 line-clamp-4">
              {item.description}
            </p>

            <div className="mt-auto border-t border-slate-100 pt-5">
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
                Closing Date: {new Date(item.deadline).toLocaleDateString()}
              </div>

              <div className="flex gap-3">
                {item.notificationLink && (
                  <a
                    href={item.notificationLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 rounded-2xl bg-slate-100 py-2.5 text-center text-sm font-semibold text-slate-700 transition-colors duration-200 hover:bg-slate-200"
                  >
                    Circular
                  </a>
                )}

                {item.applyLink && (
                  <a
                    href={item.applyLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 rounded-2xl bg-slate-950 py-2.5 text-center text-sm font-semibold text-white transition-colors duration-200 hover:bg-slate-800"
                  >
                    Portal
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
