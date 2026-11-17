"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpenCheck, Plus } from "lucide-react";

const LINKS = [
  { href: "/workspace/submissions", label: "Submissions" },
  { href: "/workspace/editorial", label: "Editorial" },
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
    <nav
      aria-label="Workspace"
      className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--card-border)] pb-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <BookOpenCheck
          className="h-8 w-8 sm:h-9 sm:w-9 md:h-10 md:w-10 text-slate-900 dark:text-slate-100"
          aria-hidden="true"
        />
        <span className="hidden sm:inline ml-2 text-sm font-semibold text-slate-950 dark:text-slate-50">
          Publishing workspace
        </span>
      </div>

      {links.map((link) => {
        const active = activeHref === link.href;

        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "rounded-full bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white dark:bg-slate-100 dark:text-slate-900"
                : "rounded-full px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            }
          >
            {link.label}
          </Link>
        );
      })}
      <Link
        href="/workspace/submissions/new"
        className="sb-button-primary inline-flex items-center gap-1.5 px-3 py-1.5 text-sm"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        New submission
      </Link>
    </nav>
  );
}