import prisma from "@/lib/db";
import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";

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
    <main className="mx-auto max-w-5xl py-6">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="mb-2 text-3xl font-semibold tracking-tight text-slate-950">
            Find a Supervisor
          </h1>
          <p className="text-slate-600">
            Read and share mentorship experiences from fellow scholars.
          </p>
        </div>
        <Link
          href="/supervisor/add"
          className="sb-button-accent whitespace-nowrap"
        >
          + Add Supervisor
        </Link>
      </div>

      <form className="relative mb-10">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
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
          className="sb-input pl-12"
          defaultValue={q}
        />
      </form>

      {supervisors.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2">
          {supervisors.map((s) => (
            <Link
              key={s.id}
              href={`/supervisor/${s.id}`}
              className="sb-card sb-card-hover group flex flex-col"
            >
              <h2 className="mb-1 text-xl font-semibold text-slate-950 group-hover:text-blue-700 transition-colors">
                {s.name}
              </h2>
              <p className="flex-grow text-sm font-medium text-slate-500">
                {s.university}
              </p>

              <div className="mt-6 flex items-center border-t border-slate-100 pt-4 text-sm font-semibold text-blue-700">
                View Recommendations{" "}
                <span className="ml-1 group-hover:translate-x-1 transition-transform">
                  →
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center rounded-[28px] border border-dashed border-slate-200 bg-white/80 px-6 py-16 text-center shadow-sm">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-slate-50">
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
          <p className="mb-6 text-lg font-medium text-slate-600">
            Couldn&apos;t find the supervisor you&apos;re looking for?
          </p>
          <Link href="/supervisor/add" className="sb-button-primary">
            Add them to <BrandMark className="font-semibold" />
          </Link>
        </div>
      )}
    </main>
  );
}
