"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/workspace/submissions", label: "Submissions" },
  { href: "/workspace/editorial", label: "Editorial" },
] as const;

/**
 * Workspace navigation.
 *
 * Only routes that exist are listed. `Admin` is added by the layout for a
 * platform administrator; venue editors reach their own surfaces through
 * `Editorial`, which every signed-in user can open (the page explains when they
 * hold no seat).
 */
export function WorkspaceNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();

  const links = isAdmin
    ? [...LINKS, { href: "/workspace/admin", label: "Administration" } as const]
    : LINKS;

  return (
    <nav aria-label="Workspace" className="flex flex-wrap items-center gap-1 border-b border-[var(--card-border)] pb-3">
      {links.map((link) => {
        const active =
          pathname === link.href || pathname.startsWith(`${link.href}/`);

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
    </nav>
  );
}
