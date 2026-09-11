"use client";

/**
 * Global loading boundary for App Router transitions.
 *
 * With prefetch={false} on every route link, navigations now happen on
 * demand. This skeleton is a cheap static shell shown while the target page
 * resolves its data on the server, so transitions feel instant without
 * triggering background SSR for pages the user never visits.
 *
 * app/loading.tsx is the fallback for any segment that does not define its
 * own loading.tsx, so every dynamic /[id] and /[slug] detail route (journals,
 * supervisors, grants, etc.) reuses this single shell.
 */
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="sb-card p-6 shadow-sm sm:p-8">
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
      <p className="pt-2 text-center text-xs text-slate-400 dark:text-slate-500">Loading…</p>
    </div>
  );
}
