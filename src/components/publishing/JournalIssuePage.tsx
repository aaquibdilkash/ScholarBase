import Link from "next/link";
import Image from "next/image";

import { ArticleList } from "@/components/publishing/ArticleList";
import { RichContent } from "@/components/content/RichContent";
import { VenueImprint, VenueMasthead } from "@/components/publishing/VenueMasthead";
import type { ArticleSummary, PublicJournalIssue, PublicVenue } from "@/lib/publishing/public";

export function JournalIssuePage({ venue, issue, articles, preview }: { venue: PublicVenue; issue: PublicJournalIssue; articles: ArticleSummary[]; preview: boolean }) {
  return <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
    <VenueMasthead venue={venue} preview={preview} activeTab="archive" trail={`Volume ${issue.volume}, Issue ${issue.number}`} />
    <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_17rem]">
      <div className="space-y-6">
        <section className="sb-card">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700 dark:text-blue-300">Journal issue</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">Volume {issue.volume}, Issue {issue.number}</h1>
          {issue.coverImageUrl ? <Image src={issue.coverImageUrl} alt="" width={960} height={320} unoptimized className="mt-4 h-48 w-full rounded-xl object-cover" /> : null}
          {issue.title ? <p className="mt-2 text-lg text-slate-600 dark:text-slate-300">{issue.title}</p> : null}
          {issue.description ? <div className="mt-4"><RichContent content={issue.description} /></div> : null}
        </section>
        {issue.editorialHtml ? <section className="sb-card"><h2 className="text-xl font-semibold">Editorial</h2><div className="mt-4"><RichContent content={issue.editorialHtml} /></div></section> : null}
        <section className="sb-card"><h2 className="text-xl font-semibold">Articles</h2><div className="mt-4">{articles.length ? <ArticleList venue={venue} articles={articles} /> : <p className="text-sm text-slate-600 dark:text-slate-400">No articles have been published in this issue yet.</p>}</div></section>
      </div>
      <aside><section className="sb-card"><h2 className="text-base font-semibold">Issue details</h2><dl className="mt-3 space-y-3 text-sm"><div className="flex justify-between gap-3"><dt className="text-slate-500">Status</dt><dd className="font-medium">{issue.status}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-500">Articles</dt><dd className="font-medium">{articles.length}</dd></div>{issue.doi ? <div className="flex justify-between gap-3"><dt className="text-slate-500">DOI</dt><dd className="text-right font-medium">{issue.doi}</dd></div> : null}</dl><Link className="mt-4 block border-t border-[var(--card-border)] pt-4 font-medium text-blue-700 hover:underline dark:text-blue-300" href={`/sbj/${venue.slug}/archive`}>All issues</Link></section></aside>
    </div>
    <VenueImprint venue={venue} />
  </main>;
}
