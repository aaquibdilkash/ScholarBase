import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

const clsx = (...inputs: Array<string | false | null | undefined>) =>
  inputs.filter(Boolean).join(" ");

export type CreateOrEditPageShellProps = {
  title: string;
  description?: string;
  backHref: string;
  backLabel?: string; // includes leading "" if desired
  maxWidth?: "sm" | "md" | "lg" | "xl";
  className?: string;
  children: ReactNode;
};

export default function CreateOrEditPageShell({
  title,
  description,
  backHref,
  backLabel = "Back",
  maxWidth = "md",
  className,
  children,
}: CreateOrEditPageShellProps) {
  const maxWidthClass = {
    sm: "max-w-3xl",
    md: "max-w-4xl",
    lg: "max-w-5xl",
    xl: "max-w-6xl",
  }[maxWidth];

  return (
    <main
      className={clsx(
        `mx-auto w-full ${maxWidthClass} py-8 px-0 sm:py-8 sm:px-6 lg:px-8`,
        className,
      )}
    >
      <div className="mb-8">
        <Link
          prefetch={false}
          href={backHref}
          className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 hover:text-blue-700 dark:text-slate-300 dark:hover:bg-slate-800 mb-8"
        >
          <ChevronLeft className="h-4 w-4" />
          {backLabel}
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 break-words text-slate-600 dark:text-slate-400">
            {description}
          </p>
        ) : null}
      </div>

      {children}
    </main>
  );
}
