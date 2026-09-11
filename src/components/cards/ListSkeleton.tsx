/**
 * Reusable placeholder shown while a list's server data resolves.
 *
 * Only the *data-dependent* region of a page is wrapped in a <Suspense>
 * boundary (see `AsyncListRegion`), so this skeleton replaces just the card
 * rows — the page heading, description, tabs and "Add" buttons (which carry no
 * data dependency) stay interactive above it.
 */
export function ListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-6" role="status">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="sb-card p-6 shadow-sm sm:p-8"
        >
          {/* Header: avatar + author line */}
          <div className="mb-4 flex items-center gap-3">
            <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-3/5 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
              <div className="h-3 w-2/5 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
            </div>
          </div>

          {/* Body */}
          <div className="space-y-2.5">
            <div className="h-5 w-4/5 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
            <div className="h-4 w-full animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
            <div className="h-4 w-11/12 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
            <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
          </div>

          {/* Footer: meta badges */}
          <div className="mt-4 flex gap-2">
            <div className="h-6 w-16 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
            <div className="h-6 w-14 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
          </div>
        </div>
      ))}
    </div>
  );
}
