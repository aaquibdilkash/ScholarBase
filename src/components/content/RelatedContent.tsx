import Link from "next/link";

import type { RelatedContentItem } from "@/lib/semantic/related";

export type RelatedContentProps = {
  /** Section heading, e.g. "Related publications". */
  title: string;
  items: RelatedContentItem[];
};

/**
 * Same-type recommendations below a detail card. Server component: the page
 * already awaited the HNSW lookup, so this only renders links. Renders nothing
 * when the source has no vector yet, keeping the detail page unchanged until
 * the background worker catches up.
 */
export default function RelatedContent({
  title,
  items,
}: RelatedContentProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="mt-6" aria-labelledby="related-content-heading">
      <h2
        id="related-content-heading"
        className="mb-3 px-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
      >
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
              <span className="line-clamp-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                {item.title}
              </span>
              {item.subtitle ? (
                <span className="mt-0.5 line-clamp-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                  {item.subtitle}
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
