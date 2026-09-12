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
 *
 * IMPORTANT: This skeleton includes the page-header area (title + tabs) so
 * that the ListPageShell heading stays visible during navigation loading on
 * mobile — the previous version rendered only card skeletons which made the
 * header disappear until the page fully loaded.
 */
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      {/* ── Page header skeleton (matches ListPageShell structure) ── */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          {/* Title skeleton */}
          <div className="h-9 w-48 animate-pulse rounded bg-slate-200 dark:bg-slate-700 sm:h-10 sm:w-56" />
          {/* Description skeleton */}
          <div className="mt-2 h-4 w-3/4 animate-pulse rounded bg-slate-200 dark:bg-slate-700 sm:mt-2 sm:w-2/3" />
        </div>
        {/* Add button skeleton */}
        <div className="h-10 w-full animate-pulse rounded-xl bg-slate-950 dark:bg-slate-100 sm:w-auto sm:max-w-[160px]" />
      </div>

      {/* ── Tabs skeleton ── */}
      <div className="mb-8 flex w-full flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white/80 p-1.5 shadow-sm dark:border-slate-800 dark:bg-slate-950/80 sm:inline-flex sm:w-auto sm:gap-0">
        <div className="h-9 w-20 animate-pulse rounded-xl bg-slate-950 text-white shadow-sm dark:bg-slate-100 dark:text-slate-950 sm:border-sm" />
        <div className="h-9 w-20 animate-pulse rounded-xl bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 sm:border-sm" />
      </div>

      {/* ── Card list skeleton ── */}
      <div className="space-y-6">
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
      </div>
      <p className="pt-2 text-center text-xs text-slate-400 dark:text-slate-500">
        Loading…
      </p>
    </div>
  );
}
