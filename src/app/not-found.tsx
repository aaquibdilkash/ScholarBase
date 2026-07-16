import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex h-[calc(100vh-120px)] flex-col items-center justify-center px-4">
      <div className="flex w-full max-w-md flex-col items-center rounded-[32px] border border-dashed border-slate-200 bg-white/80 px-6 py-16 text-center shadow-sm">
        <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-slate-50 ring-[12px] ring-slate-50/50">
          <svg
            className="h-12 w-12"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              className="text-slate-300"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.5"
              d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
            />
            <path
              className="text-blue-500"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M15.75 15.75l-2.489-2.489m0 0a3.375 3.375 0 10-4.773-4.773 3.375 3.375 0 004.774 4.774z"
            />
          </svg>
        </div>

        <h1 className="mb-3 text-2xl font-bold tracking-tight text-slate-950">
          Page Not Found
        </h1>
        <p className="mb-8 text-sm font-medium leading-relaxed text-slate-600">
          We do not find the research or page you were looking for. It might
          have been moved, deleted, or it never existed.
        </p>

        <Link
          href="/"
          className="rounded-xl bg-slate-950 px-8 py-3.5 font-semibold text-white shadow-sm transition-all hover:bg-slate-800 hover:ring-4 hover:ring-slate-100"
        >
          Return to Home
        </Link>
      </div>
    </main>
  );
}
