import Link from "next/link";
import { notFound } from "next/navigation";

import { ArticleList, issueLocator } from "@/components/publishing/ArticleList";
import {
  VenueImprint,
  VenueMasthead,
  venueBasePath,
} from "@/components/publishing/VenueMasthead";
import { formatDate } from "@/utils/date";
import {
  getPublishedArticles,
  getConferenceEditions,
  getVenuePage,
  groupIntoIssues,
  issueStats,
  type ArticleSummary,
  type PublicVenue,
  type VenueType,
  type PublicConferenceEdition,
} from "@/lib/publishing/public";

/**
 * The archive is the evidence that a serial exists.
 *
 * ISSN reviewers reject an empty site, and readers arrive at an archive from a
 * citation far more often than at a home page. Every issue is therefore a real
 * table of contents with page ranges, not a list of titles.
 */

function IssueHeading({
  volume,
  issue,
  date,
  href,
}: {
  volume: number | null;
  issue: number | null;
  date: Date | null;
  href?: string;
}) {
  const locator = issueLocator(volume, issue);

  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--card-border)] pb-3">
      <h2 className="text-lg font-semibold tracking-tight text-slate-950 dark:text-slate-50">
        {href ? <Link className="hover:text-blue-700 dark:hover:text-blue-300" href={href}>{volume === null && issue === null ? "Online first" : locator ?? "Issue"}</Link> : volume === null && issue === null ? "Online first" : locator ?? "Issue"}
      </h2>
      {date ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">{formatDate(date)}</p>
      ) : null}
    </div>
  );
}

function JournalArchive({
  venue,
  articles,
}: {
  venue: PublicVenue;
  articles: ArticleSummary[];
}) {
  const issues = groupIntoIssues(articles);
  const stats = issueStats(issues);

  if (issues.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-[var(--card-border)] px-4 py-8 text-sm text-slate-500 dark:text-slate-400">
        The archive is empty. The first issue is in preparation — accepted
        manuscripts will appear here once published.
      </p>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[13rem_minmax(0,1fr)]">
      <nav aria-label="Volumes" className="h-fit lg:sticky lg:top-6">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {stats.articleCount} article{stats.articleCount === 1 ? "" : "s"} ·{" "}
          {stats.volumeCount} volume{stats.volumeCount === 1 ? "" : "s"}
        </h2>
        <ul className="mt-3 space-y-1">
          {issues.map((group) => (
            <li key={`${group.volume}-${group.issue}`}>
              <a
                className="block rounded-lg px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                href={`#issue-${group.volume ?? "online"}-${group.issue ?? "online"}`}
              >
                {group.volume === null
                  ? "Online first"
                  : (issueLocator(group.volume, group.issue) ?? "Issue")}
                <span className="ml-1 text-xs text-slate-400">
                  ({group.articles.length})
                </span>
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="space-y-8">
        {issues.map((group) => (
          <section
            key={`${group.volume}-${group.issue}`}
            id={`issue-${group.volume ?? "online"}-${group.issue ?? "online"}`}
            className="scroll-mt-6"
          >
            <IssueHeading
              volume={group.volume}
              issue={group.issue}
              date={group.latest}
              href={group.volume !== null ? `/sbj/${venue.slug}/issues/${group.volume}/${group.issue ?? 1}` : undefined}
            />
            <div className="mt-4">
              <ArticleList venue={venue} articles={group.articles} />
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function ConferenceArchive({
  venue,
  articles,
  editions,
}: {
  venue: PublicVenue;
  articles: ArticleSummary[];
  editions: PublicConferenceEdition[];
}) {
  const issues = groupIntoIssues(articles);
  const volumes = issues.filter((group) => group.volume !== null);
  const online = issues.find((group) => group.volume === null) ?? null;
  const base = venueBasePath(venue.type);

  if (articles.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-[var(--card-border)] px-4 py-8 text-sm text-slate-500 dark:text-slate-400">
        No papers have been published for this conference yet.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      {editions.length > 0 ? (
        <section>
          <h2 className="text-lg font-semibold tracking-tight text-slate-950 dark:text-slate-50">Conference editions</h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {editions.map((edition) => (
              <li key={edition.id} className="sb-card">
                <Link className="text-sm font-semibold text-blue-700 underline-offset-2 hover:underline dark:text-blue-300" href={`${base}/${venue.slug}/${edition.slug}`}>{edition.label}</Link>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{edition.status.replace(/_/g, " ")}{edition.volume ? ` · Proceedings volume ${edition.volume}` : ""}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {volumes.length > 0 ? (
        <section>
          <h2 className="text-lg font-semibold tracking-tight text-slate-950 dark:text-slate-50">
            Proceedings volumes
          </h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {volumes.map((group) => {
              const isbn = group.articles.find((article) => article.isbn)?.isbn;
              return (
                <li key={`${group.volume}-${group.issue ?? ""}`} className="sb-card">
                  <Link
                    className="text-sm font-semibold text-blue-700 underline-offset-2 hover:underline dark:text-blue-300"
                    href={`${base}/${venue.slug}/proceedings/${group.volume}`}
                  >
                    {issueLocator(group.volume, group.issue) ?? "Volume"}
                  </Link>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {group.articles.length} paper
                    {group.articles.length === 1 ? "" : "s"}
                    {isbn ? ` · ISBN ${isbn}` : ""}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {online ? (
        <section>
          <IssueHeading volume={null} issue={null} date={online.latest} />
          <div className="mt-4">
            <ArticleList venue={venue} articles={online.articles} />
          </div>
        </section>
      ) : null}

      {volumes.map((group) => (
        <section
          key={`body-${group.volume}-${group.issue ?? ""}`}
          id={`volume-${group.volume}`}
          className="scroll-mt-6"
        >
          <IssueHeading
            volume={group.volume}
            issue={group.issue}
            date={group.latest}
          />
          <div className="mt-4">
            <ArticleList venue={venue} articles={group.articles} />
          </div>
        </section>
      ))}
    </div>
  );
}

export async function VenueArchivePage({
  slug,
  type,
}: {
  slug: string;
  type: VenueType;
}) {
  const result = await getVenuePage(slug, type);
  if (!result) notFound();

  const [articles, editions] = await Promise.all([
    getPublishedArticles(result.venue.id, 500),
    result.venue.type === "CONFERENCE" ? getConferenceEditions(result.venue.id, result.preview) : Promise.resolve([]),
  ]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <VenueMasthead
        venue={result.venue}
        preview={result.preview}
        activeTab="archive"
        trail="Archive"
      />
      <div className="mt-8">
        {result.venue.type === "JOURNAL" ? (
          <JournalArchive venue={result.venue} articles={articles} />
        ) : (
          <ConferenceArchive venue={result.venue} articles={articles} editions={editions} />
        )}
      </div>
      <VenueImprint venue={result.venue} />
    </main>
  );
}
