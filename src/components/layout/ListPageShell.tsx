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
    <main className={clsx("mx-auto max-w-3xl py-6", className)}>
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
            {title}
          </h1>
          {description ? (
            <p className="mt-2 text-sm text-slate-600">{description}</p>
          ) : null}
        </div>

        {addHref && addLabel ? (
          <Link href={addHref} className="sb-button-accent whitespace-nowrap">
            {addLabel}
          </Link>
        ) : null}
      </div>

      {enableTrending && trendingHref ? (
        <div className="mb-8 inline-flex rounded-2xl border border-slate-200 bg-white/80 p-1.5 shadow-sm">
          <Link
            href={allHref}
            className={clsx(
              "px-6 py-2 rounded-xl font-semibold transition-all",
              !isTrendingTab
                ? "bg-slate-950 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-900",
            )}
          >
            All
          </Link>
          <Link
            href={trendingHref}
            className={clsx(
              "px-6 py-2 rounded-xl font-semibold transition-all",
              isTrendingTab
                ? "bg-slate-950 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-900",
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
