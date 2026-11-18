import Link from "next/link";
import Image from "next/image";

import { ArticleList } from "@/components/publishing/ArticleList";
import { VenueImprint, VenueMasthead, venueBasePath } from "@/components/publishing/VenueMasthead";
import type { PublicConferenceEdition, PublicVenue, ArticleSummary } from "@/lib/publishing/public";
import { formatIsbn13 } from "@/lib/publishing/identifiers";
import { conferenceEditionLabel } from "@/lib/publishing/public";

export function ConferenceEditionPage({
  venue,
  edition,
  articles,
  preview,
}: {
  venue: PublicVenue;
  edition: PublicConferenceEdition;
  articles: ArticleSummary[];
  preview: boolean;
}) {
  const base = venueBasePath(venue.type);
  const isbn = edition.isbn ? formatIsbn13(edition.isbn) || edition.isbn : null;
  const date = edition.startsAt?.toLocaleDateString("en", { dateStyle: "long", timeZone: "UTC" });

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <VenueMasthead venue={venue} preview={preview} activeTab="archive" trail={conferenceEditionLabel(edition)} />
      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="space-y-6">
          <section className="sb-card">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700 dark:text-blue-300">Conference edition</p>
            <h1 className="mt-2 text-2xl font-semibold leading-tight tracking-tight text-slate-950 dark:text-slate-50">{edition.label}</h1>
            {edition.coverImageUrl ? <Image src={edition.coverImageUrl} alt="" width={960} height={320} unoptimized className="mt-4 h-48 w-full rounded-xl object-cover" /> : null}
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              {date ?? edition.year}{edition.location ? ` · ${edition.location}` : ""}{edition.volume ? ` · Proceedings volume ${edition.volume}` : ""}
            </p>
            {preview ? <p className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-900/20 dark:text-amber-200">Editor preview — this edition is not public yet.</p> : null}
          </section>
          <section className="sb-card">
            <h2 className="text-xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">Published papers</h2>
            <div className="mt-4">
              {articles.length > 0 ? <ArticleList venue={venue} articles={articles} /> : <p className="text-sm text-slate-600 dark:text-slate-400">No papers have been published in this edition yet.</p>}
            </div>
          </section>
          {edition.programItems.length > 0 ? <section className="sb-card"><h2 className="text-xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">Program</h2><ol className="mt-4 space-y-3">{edition.programItems.map((item) => <li key={item.id} className="rounded-xl border border-[var(--card-border)] p-3"><div className="flex flex-wrap items-baseline justify-between gap-2"><p className="font-medium">{item.title}</p><span className="text-xs uppercase tracking-wide text-slate-500">{item.type.replace(/_/g, " ")}</span></div>{item.startsAt ? <p className="mt-1 text-xs text-slate-500">{new Date(item.startsAt).toLocaleString("en", { dateStyle: "medium", timeStyle: "short", timeZone: edition.timezone || "UTC" })}{item.room ? ` · ${item.room}` : ""}</p> : null}{item.speakers ? <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{item.speakers}</p> : null}{item.description ? <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">{item.description}</p> : null}{item.externalUrl ? <a className="mt-2 inline-block text-sm font-medium text-blue-700 hover:underline dark:text-blue-300" href={item.externalUrl} target="_blank" rel="noopener noreferrer">Session link</a> : null}</li>)}</ol></section> : null}
        </div>
        <aside className="space-y-6">
          <section className="sb-card">
            <h2 className="text-base font-semibold text-slate-950 dark:text-slate-50">Edition details</h2>
            <dl className="mt-3 space-y-3 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-slate-500 dark:text-slate-400">Status</dt><dd className="font-medium">{edition.status.replace(/_/g, " ")}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500 dark:text-slate-400">Papers</dt><dd className="font-medium">{articles.length}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500 dark:text-slate-400">ISBN</dt><dd className="text-right font-medium">{isbn ?? "Assigned with proceedings"}</dd></div>
            </dl>
            <div className="mt-4 border-t border-[var(--card-border)] pt-4">
              <Link className="font-medium text-blue-700 underline-offset-2 hover:underline dark:text-blue-300" href={`${base}/${venue.slug}/archive`}>All editions</Link>
            </div>
          </section>
        </aside>
      </div>
      <VenueImprint venue={venue} />
    </main>
  );
}
