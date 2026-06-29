import prisma from "@/lib/db";
import Link from "next/link";

export default async function SupervisorDirectory({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supervisors = await prisma.supervisor.findMany({
    where: q ? { name: { contains: q, mode: "insensitive" } } : {},
  });

  return (
    <main className="max-w-4xl mx-auto py-10 px-4">
      <div className="flex flex-col md:flex-row md:justify-between md:items-end mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-2">
            Find a Supervisor
          </h1>
          <p className="text-slate-500">
            Read and share mentorship experiences from fellow scholars.
          </p>
        </div>
        <Link
          href="/supervisor/add"
          className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-semibold shadow-sm shadow-blue-600/20 hover:bg-blue-700 hover:shadow-md hover:shadow-blue-600/30 transition-all duration-200 whitespace-nowrap"
        >
          + Add Supervisor
        </Link>
      </div>

      <form className="mb-10 relative">
        {/* Decorative search icon */}
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <svg
            className="h-5 w-5 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
        <input
          name="q"
          placeholder="Search by professor's name..."
          className="w-full pl-12 p-4 bg-white border border-slate-200/80 rounded-2xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-slate-900 placeholder:text-slate-400"
          defaultValue={q}
        />
      </form>

      {supervisors.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {supervisors.map((s) => (
            <Link
              key={s.id}
              href={`/supervisor/${s.id}`}
              className="group bg-white border border-slate-200/60 rounded-2xl p-6 shadow-sm hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:-translate-y-1 hover:border-blue-100 transition-all duration-300 flex flex-col"
            >
              <h2 className="text-xl font-bold text-slate-900 mb-1 group-hover:text-blue-600 transition-colors">
                {s.name}
              </h2>
              <p className="text-sm font-medium text-slate-500 flex-grow">
                {s.university}
              </p>

              <div className="mt-6 pt-4 border-t border-slate-50 flex items-center text-sm font-semibold text-blue-600">
                View Recommendations{" "}
                <span className="ml-1 group-hover:translate-x-1 transition-transform">
                  →
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 px-6 border-2 border-dashed border-slate-200 rounded-3xl bg-white shadow-sm flex flex-col items-center">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-5">
            <svg
              className="w-8 h-8 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 4v16m8-8H4"
              ></path>
            </svg>
          </div>
          <p className="text-slate-600 mb-6 text-lg font-medium">
            Couldn't find the supervisor you're looking for?
          </p>
          <Link
            href="/supervisor/add"
            className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-black transition-colors shadow-sm"
          >
            Add them to ScholarBase
          </Link>
        </div>
      )}
    </main>
  );
}
