"use client";

import Link from "next/link";
import { Star, UserPlus, Users, type LucideIcon } from "lucide-react";
import { UserAvatar } from "@/components/ui/UserAvatar";

import type { RelatedContentItem } from "@/lib/semantic/related";

export type RelatedContentProps = {
  /** Section heading, e.g. "Related publications". */
  title: string;
  items: RelatedContentItem[];
};

/**
 * Same-type recommendations rendered in the detail page sidebar. Server
 * component: the page already awaited the HNSW lookup, so this only renders
 * links. Renders nothing when the source has no vector yet, keeping the detail
 * page unchanged until the background worker catches up.
 *
 * Layout per item:
 *   [avatar]  [name]     [title / post text ...]   [image if exists]
   *           @handle
 */
export default function RelatedContent({
  title,
  items,
}: RelatedContentProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="mt-6 xl:mt-0" aria-label={title}>
      <h2 className="mb-3 px-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {title}
      </h2>

      <ul className="sb-card divide-y divide-slate-100 overflow-hidden p-2 sm:p-2 dark:divide-slate-800">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              prefetch={false}
              href={item.href}
              className="block rounded-xl px-3 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60"
            >
              <div className="flex items-start gap-3">
                {/* Avatar on far left */}
                <div className="shrink-0 h-9 w-9 rounded-full bg-slate-800 flex items-center justify-center overflow-hidden">
                  {item.avatarUrl ? (
                    <UserAvatar
                      src={item.avatarUrl}
                      name={item.authorName}
                      imageClassName="h-full w-full"
                    />
                  ) : (
                    <span className="text-xs font-medium text-slate-300 uppercase">
                      {item.authorName?.charAt(0) || "?"}
                    </span>
                  )}
                </div>

                {/* Middle: name above handle, title below (scholars omit the
                    duplicate title because the name is already the heading) */}
                <div className="min-w-0 flex-1">
                  {item.authorName ? (
                    <>
                      <span className="block truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {item.authorName}
                      </span>
                      {item.authorHandle ? (
                        <span className="mt-0.5 block truncate text-xs font-medium text-slate-500 dark:text-slate-400">
                          @{item.authorHandle}
                        </span>
                      ) : null}
                    </>
                  ) : null}
                  {!item.stats ? (
                    <span className="mt-1 block line-clamp-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {item.title}
                    </span>
                  ) : null}
                </div>

                {/* Scholars: followers / following / reputation on the right.
                    Mobile keeps the same row: icon + count only, labels from sm. */}
                {item.stats ? (
                  <div className="flex shrink-0 items-center gap-2 self-center sm:gap-4">
                    <Stat
                      icon={Users}
                      value={item.stats.followers}
                      label="Followers"
                    />
                    <Stat
                      icon={UserPlus}
                      value={item.stats.following}
                      label="Following"
                    />
                    <Stat
                      icon={Star}
                      value={item.stats.reputation}
                      label="Reputation"
                      tone="amber"
                    />
                  </div>
                ) : item.imageUrl ? (
                  <div className="shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element -- remote user content; next/image adds no value with images unoptimized */}
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      loading="lazy"
                      className="h-16 w-16 rounded-lg object-cover"
                    />
                  </div>
                ) : null}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * One compact counter in a scholar row. Below `sm` it collapses to an icon plus
 * the number so three counters still fit on the same line; from `sm` up it
 * shows the number above a tiny label.
 */
function Stat({
  value,
  label,
  icon: Icon,
  tone = "slate",
}: {
  value: number;
  label: string;
  icon: LucideIcon;
  tone?: "slate" | "amber";
}) {
  return (
    <span
      title={label}
      className="flex flex-row items-center gap-1 sm:flex-col sm:gap-0"
    >
      <Icon
        aria-hidden="true"
        className={
          tone === "amber"
            ? "h-3.5 w-3.5 text-amber-500 sm:hidden"
            : "h-3.5 w-3.5 text-slate-400 dark:text-slate-500 sm:hidden"
        }
      />
      <span
        className={
          tone === "amber"
            ? "text-xs font-semibold tabular-nums text-amber-600 dark:text-amber-400 sm:text-sm"
            : "text-xs font-semibold tabular-nums text-slate-900 dark:text-slate-100 sm:text-sm"
        }
      >
        {value}
      </span>
      {/* The icon replaces the label on mobile; keep it for screen readers. */}
      <span className="sr-only sm:hidden">{label}</span>
      <span className="hidden text-[10px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500 sm:block">
        {label}
      </span>
    </span>
  );
}
