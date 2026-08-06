import { FileSearch } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex h-[calc(100vh-120px)] flex-col items-center justify-center px-4">
      <div className="flex w-full max-w-md flex-col items-center rounded-[32px] border border-dashed border-slate-200 bg-white/80 px-6 py-16 text-center shadow-sm">
        <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-slate-50 ring-[12px] ring-slate-50/50">
          <FileSearch className="h-12 w-12 text-slate-400" />
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
