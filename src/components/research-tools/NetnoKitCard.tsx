import Link from "next/link";

export function NetnoKitCard() {
  return (
    <article className="sb-card min-w-0 w-full p-6 sm:p-6 md:p-8">
      <div className="mb-4 flex items-center justify-between gap-4 border-b border-slate-100 pb-3 dark:border-slate-800">
        <div className="min-w-0">
          <span className="inline-flex rounded-full bg-slate-900 px-2 py-0.5 text-xs font-semibold text-white dark:bg-slate-100 dark:text-slate-900">
            Built by ScholarBase
          </span>
        </div>
        <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">
          Research tool
        </span>
      </div>

      <Link
        href="/research-tools/netnography-exporter"
        prefetch={false}
        className="block group"
      >
        <h2 className="mb-2 break-words text-lg font-semibold leading-tight text-slate-950 transition-colors group-hover:text-blue-700 dark:text-slate-50 dark:group-hover:text-blue-300">
          NetnoKit — Netnography Comment Exporter
        </h2>
        <p className="break-words text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          Export YouTube and Instagram comments as CSV or Excel with IRB-friendly
          anonymization.
        </p>
      </Link>

      <Link
        href="/research-tools/netnography-exporter"
        prefetch={false}
        className="mt-6 block rounded-lg bg-slate-950 py-2 text-center text-xs font-semibold text-white transition-colors duration-200 hover:bg-slate-800"
      >
        Open Tool
      </Link>
    </article>
  );
}
