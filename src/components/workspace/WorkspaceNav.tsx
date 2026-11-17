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
        <Link
          href="/workspace/submissions"
          className="mr-1 inline-flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-slate-50"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900">
            <BookOpenCheck className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="hidden sm:inline">Publishing workspace</span>
        </Link>

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
      </div>

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
