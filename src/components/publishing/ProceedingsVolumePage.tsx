import Link from "next/link";
import { notFound } from "next/navigation";

import { ArticleList } from "@/components/publishing/ArticleList";
import {
  VenueImprint,
  VenueMasthead,
  venueBasePath,
} from "@/components/publishing/VenueMasthead";
import { formatIsbn13 } from "@/lib/publishing/identifiers";
import { type ArticleSummary, type PublicVenue } from "@/lib/publishing/public";
import { formatDate } from "@/utils/date";

/**
 * A proceedings volume as a citable object.
 *
 * An ISBN is assigned to the *volume*, not to the individual papers, so the
 * volume needs a page that shows the title page and the table of contents the
 * ISBN was issued for: volume title, editors, year, publisher, ISBN, and page
 * ranges. This is the page the copyright block is checked against.
 */
export function ProceedingsVolumePage({
  venue,
  volume,
  articles,
  preview,
}: {
  venue: PublicVenue;
  volume: number;
  articles: ArticleSummary[];
  preview: boolean;
}) {
  if (articles.length === 0) notFound();

  const base = venueBasePath(venue.type);
  const isbnRaw = articles.find((article) => article.isbn)?.isbn ?? null;
  const isbn = isbnRaw ? formatIsbn13(isbnRaw) || isbnRaw : null;
  const year = articles.find((article) => article.publishedAt)?.publishedAt ?? null;
  const editors = venue.board.filter((member) =>
    /editor|chair/i.test(member.roleTitle),
  );
  const pages = articles
    .map((article) => article.firstPage)
    .filter((page): page is string => Boolean(page));

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <VenueMasthead
        venue={venue}
        preview={preview}
        activeTab="archive"
        trail={`Volume ${volume}`}
      />

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="space-y-6">
          <section className="sb-card">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700 dark:text-blue-300">
              Proceedings volume
            </p>
            <h1 className="mt-2 text-2xl font-semibold leading-tight tracking-tight text-slate-950 dark:text-slate-50">
              Proceedings of {venue.name}
            </h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Volume {volume}
              {year ? ` · ${new Date(year).getUTCFullYear()}` : ""}
              {isbn ? ` · ISBN ${isbn}` : ""}
            </p>

            <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Publisher
                </dt>
                <dd className="mt-1 font-medium">{venue.publisherName}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  ISBN
                </dt>
                <dd className="mt-1 font-medium">{isbn ?? "Assigned on publication"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Papers
                </dt>
                <dd className="mt-1 font-medium">{articles.length}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Pages
                </dt>
                <dd className="mt-1 font-medium">
                  {pages.length > 0 ? `${pages[0]}–${pages[pages.length - 1]}` : "—"}
                </dd>
              </div>
            </dl>

            {editors.length > 0 ? (
              <div className="mt-5 border-t border-[var(--card-border)] pt-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Volume editors
                </p>
                <ul className="mt-2 space-y-1 text-sm">
                  {editors.map((editor) => (
                    <li key={`${editor.name}-${editor.roleTitle}`}>
                      <span className="font-medium">{editor.name}</span>
                      {editor.affiliation ? (
                        <span className="text-slate-500 dark:text-slate-400">
                          {" "}
                          — {editor.affiliation}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>

          <section className="sb-card">
            <h2 className="text-xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
              Table of contents
            </h2>
            <div className="mt-4">
              <ArticleList venue={venue} articles={articles} />
            </div>
          </section>

          <section className="sb-card text-xs leading-6 text-slate-500 dark:text-slate-400">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Copyright and availability
            </h2>
            <p className="mt-2">
              © {year ? new Date(year).getUTCFullYear() : new Date().getUTCFullYear()}{" "}
              {venue.publisherName}. Individual papers remain the copyright of
              their authors and are published under the licence stated on each
              article page. This volume is distributed open access; the ISBN
              above identifies this collected edition.
            </p>
            {isbn ? (
              <p className="mt-2">
                Cite the volume as: {venue.publisherName} ({year ? new Date(year).getUTCFullYear() : "n.d."}).{" "}
                <em>Proceedings of {venue.name}</em>, Volume {volume}. ISBN {isbn}.
              </p>
            ) : null}
          </section>
        </div>

        <aside className="space-y-6">
          <section className="sb-card">
            <h2 className="text-base font-semibold text-slate-950 dark:text-slate-50">
              Volume details
            </h2>
            <dl className="mt-3 space-y-3 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-slate-500 dark:text-slate-400">Venue</dt>
                <dd className="text-right font-medium">{venue.name}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-slate-500 dark:text-slate-400">Volume</dt>
                <dd className="font-medium">{volume}</dd>
              </div>
              {year ? (
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-slate-500 dark:text-slate-400">Year</dt>
                  <dd className="font-medium">{new Date(year).getUTCFullYear()}</dd>
                </div>
              ) : null}
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-slate-500 dark:text-slate-400">ISBN</dt>
                <dd className="text-right font-medium">{isbn ?? "—"}</dd>
              </div>
            </dl>
            <div className="mt-4 space-y-2 border-t border-[var(--card-border)] pt-4 text-sm">
              <Link
                className="block font-medium text-blue-700 underline-offset-2 hover:underline dark:text-blue-300"
                href={`${base}/${venue.slug}/archive`}
              >
                All volumes
              </Link>
              <Link
                className="block font-medium text-blue-700 underline-offset-2 hover:underline dark:text-blue-300"
                href={`${base}/${venue.slug}`}
              >
                Conference overview
              </Link>
            </div>
          </section>

          {year ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Last paper published {formatDate(year)}.
            </p>
          ) : null}
        </aside>
      </div>

      <VenueImprint venue={venue} />
    </main>
  );
}
