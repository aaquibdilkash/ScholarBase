import Link from "next/link";
import type { ReactNode } from "react";

const clsx = (...inputs: Array<string | false | null | undefined>) =>
  inputs.filter(Boolean).join(" ");

export type ListPageShellProps = {
  title: string;
  description?: string;

  addHref?: string;
  addLabel?: string; // include leading "+" if desired

  /** Current tab from searchParams */
  tab?: string;

  /** If true, show Trending tab and render `trending` when tab=trending */
  enableTrending?: boolean;

  allHref: string;
  trendingHref?: string;

  trending: ReactNode;
  all: ReactNode;

  className?: string;
};

export default function ListPageShell({
  title,
  description,
  addHref,
  addLabel,
  tab,
  enableTrending = true,
  allHref,
  trendingHref,
  trending,
  all,
  className,
}: ListPageShellProps) {
  const isTrendingTab = enableTrending && tab === "trending";

  return (
    <main className={clsx("mx-auto w-full max-w-4xl py-6 sm:py-8", className)}>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-slate-50 sm:text-4xl">
            {title}
          </h1>
          {description ? (
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 sm:text-base">
              {description}
            </p>
          ) : null}
        </div>

        {addHref && addLabel ? (
          <Link href={addHref} className="sb-button-accent w-full whitespace-nowrap sm:w-auto">
            {addLabel}
          </Link>
        ) : null}
      </div>

      {enableTrending && trendingHref ? (
        <div className="mb-8 flex w-full flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white/80 p-1.5 shadow-sm dark:border-slate-800 dark:bg-slate-950/80 sm:inline-flex sm:w-auto sm:gap-0">
          <Link
            href={allHref}
            className={clsx(
              "rounded-xl px-6 py-2 font-semibold transition-all",
              !isTrendingTab
                ? "bg-slate-950 text-white shadow-sm dark:bg-slate-100 dark:text-slate-950"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100",
            )}
          >
            All
          </Link>
          <Link
            href={trendingHref}
            className={clsx(
              "rounded-xl px-6 py-2 font-semibold transition-all",
              isTrendingTab
                ? "bg-slate-950 text-white shadow-sm dark:bg-slate-100 dark:text-slate-950"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100",
            )}
          >
            Trending
          </Link>
        </div>
      ) : null}

      {isTrendingTab ? trending : all}
    </main>
  );
}
