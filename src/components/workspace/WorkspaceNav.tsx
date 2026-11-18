"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpenCheck, Plus } from "lucide-react";

const LINKS = [
  { href: "/workspace/submissions", label: "Submissions" },
  { href: "/workspace/editorial", label: "Editorial" },
  { href: "/workspace/editorial/board", label: "Board" },
  { href: "/workspace/editorial/settings", label: "Venue settings" },
] as const;

/**
 * Workspace navigation.
 *
 * Only routes that exist are listed. `Administration` is added for a platform
 * administrator; venue settings explain when a user holds no editor-in-chief
 * seat. The primary action is always visible: a new submission is the one thing
 * a signed-in author or editor most often comes here to do.
 *
 * "Publishing workspace" is a non-clickable brand element for now; nav pills
 * remain as the navigation.
 */
export function WorkspaceNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();

  const links = isAdmin
    ? [...LINKS, { href: "/workspace/admin", label: "Administration" } as const]
    : LINKS;
  const activeHref = [...links]
    .sort((a, b) => b.href.length - a.href.length)
    .find((link) => pathname === link.href || pathname.startsWith(`${link.href}/`))?.href;

  return (
    <nav aria-label="Workspace" className="border-b border-slate-200/80 pb-4 dark:border-slate-800">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BookOpenCheck
            className="h-8 w-8 text-slate-900 dark:text-slate-100 sm:h-9 sm:w-9"
            aria-hidden="true"
          />
          <span className="text-base font-semibold text-slate-950 dark:text-slate-50">
            Publishing workspace
          </span>
        </div>
        <Link
          href="/workspace/submissions/new"
          className="sb-button-primary inline-flex items-center gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          New submission
        </Link>
      </div>

      <div className="mt-3 overflow-x-auto">
        <ul className="flex w-max min-w-full gap-2 rounded-2xl border border-slate-200/80 bg-white/80 p-1.5 shadow-sm dark:border-slate-800 dark:bg-slate-950/80 sm:w-fit">
          {links.map((link) => {
            const active = activeHref === link.href;

            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={[
                    "block whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium transition",
                    active
                      ? "bg-slate-950 text-white dark:bg-slate-100 dark:text-slate-950"
                      : "text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-50",
                  ].join(" ")}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
