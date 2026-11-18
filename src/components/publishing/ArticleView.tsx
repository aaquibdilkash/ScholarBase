import Link from "next/link";

import { CopyCitation } from "@/components/publishing/CopyCitation";
import { RichContent } from "@/components/content/RichContent";
import {
  VenueImprint,
  VenueMasthead,
  displayIssn,
  venueBasePath,
} from "@/components/publishing/VenueMasthead";
import { JsonLd } from "@/components/seo/JsonLd";
import { SITE_URL } from "@/constants/seo";
import { formatDate } from "@/utils/date";
import {
  buildPlainCitation,
  formatPageRange,
} from "@/lib/publishing/citations";
import { buildBreadcrumbList } from "@/lib/schema";
import {
  type ArticleSummary,
  type PublicVenue,
} from "@/lib/publishing/public";

/**
 * The article landing page.
 *
 * Three audiences, in order of importance: a reader arriving from a citation,
 * Google Scholar's harvester (served by the Highwire tags in `page.tsx`), and a
 * reference manager following the RIS/BibTeX links. None of them needs the
 * article to be HTML — the PDF is the version of record — so this page is
 * metadata, abstract, and a download, with no PDF-to-HTML conversion.
 */

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-[var(--card-border)] py-2 last:border-0">
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </dt>
      <dd className="text-right text-sm text-slate-900 dark:text-slate-100">{children}</dd>
    </div>
  );
}

export function ArticleView({
  venue,
  article,
  preview,
}: {
  venue: PublicVenue;
  article: ArticleSummary;
  preview: boolean;
}) {
  const base = venueBasePath(venue.type);
  const canonical = `${base}/${venue.slug}/article/${article.id}`;
  const articleUrl = `${SITE_URL}${canonical}`;
  const citation = buildPlainCitation(article, venue);
  const issn = displayIssn(venue.eissn ?? venue.issn);
  const pages = formatPageRange(article.firstPage, article.lastPage);
  const keywords = article.keywords
    ?.split(",")
    .map((keyword) => keyword.trim())
    .filter(Boolean);

  const structuredData = [
    {
      "@type": "ScholarlyArticle",
      "@id": articleUrl,
      headline: article.title,
      name: article.title,
      ...(article.abstract ? { abstract: article.abstract } : {}),
      url: articleUrl,
      mainEntityOfPage: articleUrl,
      author: article.authors.map((author) => ({
        "@type": "Person",
        name: author.name,
        ...(author.affiliation ? { affiliation: author.affiliation } : {}),
      })),
      publisher: { "@type": "Organization", name: venue.publisherName },
      ...(article.publishedAt
        ? { datePublished: new Date(article.publishedAt).toISOString() }
        : {}),
      isPartOf: {
        "@type": "Periodical",
        name: venue.name,
        ...(issn ? { issn } : {}),
      },
      ...(article.doi
        ? { identifier: `https://doi.org/${article.doi}` }
        : { identifier: articleUrl }),
      ...(venue.licenseUrl ? { license: venue.licenseUrl } : {}),
      ...(keywords?.length ? { keywords } : {}),
      ...(pages ? { pagination: pages } : {}),
      ...(article.isbn ? { isbn: article.isbn } : {}),
      inLanguage: "en",
      ...(article.fileName ? { encodingFormat: "application/pdf" } : {}),
    },
    buildBreadcrumbList([
      { name: "ScholarBase", path: "/" },
      {
        name: venue.type === "JOURNAL" ? "Journals" : "Conferences",
        path: base,
      },
      { name: venue.name, path: `${base}/${venue.slug}` },
      { name: article.title, path: canonical },
    ]),
  ];

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <JsonLd data={structuredData} />
      <VenueMasthead
        venue={venue}
        preview={preview}
        activeTab="overview"
        trail={article.title}
      />

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <article className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700 dark:text-blue-300">
            {venue.type === "JOURNAL" ? "Research article" : "Conference paper"}
          </p>
          <h1 className="mt-2 text-2xl font-semibold leading-tight tracking-tight text-slate-950 dark:text-slate-50 sm:text-3xl">
            {article.title}
          </h1>

          {article.publicationNotices.length > 0 ? (
            <section className="mt-5 space-y-3" aria-label="Publication notices">
              {article.publicationNotices.map((notice) => (
                <div key={notice.id} className={notice.type === "RETRACTION" ? "rounded-xl border border-red-300 bg-red-50 p-4 dark:border-red-500/30 dark:bg-red-950/30" : "rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-950/20"}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-200">{notice.type.replace(/_/g, " ")}</p>
                  <h2 className="mt-1 font-semibold text-slate-950 dark:text-slate-50">{notice.title}</h2>
                  <div className="mt-2 text-sm text-slate-700 dark:text-slate-200"><RichContent content={notice.body} /></div>
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Effective {formatDate(notice.effectiveAt)}</p>
                </div>
              ))}
            </section>
          ) : null}

          <ul className="mt-4 space-y-1 text-sm">
            {article.authors.map((author, index) => (
              <li key={`${author.name}-${index}`} className="text-slate-800 dark:text-slate-200">
                <span className="font-medium">{author.name}</span>
                {author.affiliation ? (
                  <span className="text-slate-500 dark:text-slate-400">
                    {" "}
                    — {author.affiliation}
                  </span>
                ) : null}
                {author.orcid ? (
                  <a
                    className="ml-1 text-xs text-blue-700 underline dark:text-blue-300"
                    href={`https://orcid.org/${author.orcid}`}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    ORCID
                  </a>
                ) : null}
              </li>
            ))}
          </ul>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            {article.fileName ? (
              <a
                className="sb-button-primary inline-flex items-center gap-2"
                href={`/api/papers/${article.id}/file`}
              >
                Download PDF
              </a>
            ) : (
              <span className="text-sm text-slate-500 dark:text-slate-400">
                The PDF for this article is being prepared.
              </span>
            )}
            <a
              className="sb-button-soft"
              href={`/api/papers/${article.id}/cite?format=ris`}
            >
              RIS
            </a>
            <a
              className="sb-button-soft"
              href={`/api/papers/${article.id}/cite?format=bibtex`}
            >
              BibTeX
            </a>
          </div>

          {article.abstract ? (
            <section className="mt-8">
              <h2 className="text-lg font-semibold tracking-tight text-slate-950 dark:text-slate-50">
                Abstract
              </h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-7 text-slate-700 dark:text-slate-300">
                {article.abstract}
              </p>
            </section>
          ) : null}

          {keywords?.length ? (
            <section className="mt-6">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Keywords
              </h2>
              <ul className="mt-2 flex flex-wrap gap-2">
                {keywords.map((keyword) => (
                  <li
                    key={keyword}
                    className="rounded-full border border-[var(--card-border)] px-2.5 py-1 text-xs text-slate-700 dark:text-slate-300"
                  >
                    {keyword}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {[
            ["Funding", article.fundingStatement],
            ["Data and code availability", article.dataAvailabilityStatement],
            ["Ethics approval and consent", article.ethicsStatement],
            ["Competing interests", article.competingInterests],
            ["AI use", article.aiUseStatement],
          ].some(([, value]) => Boolean(value)) ? (
            <section className="mt-8" aria-label="Research integrity declarations">
              <h2 className="text-lg font-semibold tracking-tight text-slate-950 dark:text-slate-50">
                Research integrity
              </h2>
              <dl className="mt-3 divide-y divide-[var(--card-border)] rounded-xl border border-[var(--card-border)] px-4">
                {[
                  ["Funding", article.fundingStatement],
                  ["Data and code availability", article.dataAvailabilityStatement],
                  ["Ethics approval and consent", article.ethicsStatement],
                  ["Competing interests", article.competingInterests],
                  ["AI use", article.aiUseStatement],
                ].map(([label, value]) => value ? (
                  <div className="py-3" key={label}>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</dt>
                    <dd className="mt-1 whitespace-pre-line text-sm leading-6 text-slate-700 dark:text-slate-300">{value}</dd>
                  </div>
                ) : null)}
              </dl>
            </section>
          ) : null}

          <section className="mt-8">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Cite this {venue.type === "JOURNAL" ? "article" : "paper"}
              </h2>
              <CopyCitation text={citation} />
            </div>
            <p className="mt-2 rounded-xl border border-[var(--card-border)] px-3 py-3 text-sm leading-6 text-slate-700 dark:text-slate-300">
              {citation}
            </p>
          </section>
        </article>

        <aside className="space-y-6">
          <section className="sb-card">
            <h2 className="text-base font-semibold text-slate-950 dark:text-slate-50">
              Article details
            </h2>
            <dl className="mt-3">
              {article.publishedAt ? (
                <MetaRow label="Published">
                  {formatDate(article.publishedAt)}
                </MetaRow>
              ) : null}
              {article.volume !== null ? (
                <MetaRow label="Volume">{article.volume}</MetaRow>
              ) : null}
              {article.issue !== null ? (
                <MetaRow label="Issue">{article.issue}</MetaRow>
              ) : null}
              {pages ? <MetaRow label="Pages">{pages}</MetaRow> : null}
              {article.isbn ? <MetaRow label="ISBN">{article.isbn}</MetaRow> : null}
              {article.doi ? (
                <MetaRow label="DOI">
                  <a
                    className="text-blue-700 underline dark:text-blue-300"
                    href={`https://doi.org/${article.doi}`}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {article.doi}
                  </a>
                </MetaRow>
              ) : null}
              <MetaRow label="Licence">
                {venue.licenseUrl ? (
                  <a
                    className="text-blue-700 underline dark:text-blue-300"
                    href={venue.licenseUrl}
                    rel="license noopener noreferrer"
                    target="_blank"
                  >
                    CC BY 4.0
                  </a>
                ) : (
                  "Open access"
                )}
              </MetaRow>
            </dl>
          </section>

          <section className="sb-card">
            <h2 className="text-base font-semibold text-slate-950 dark:text-slate-50">
              {venue.type === "JOURNAL" ? "Published in" : "Presented at"}
            </h2>
            <Link
              className="mt-2 block text-sm font-medium text-blue-700 underline-offset-2 hover:underline dark:text-blue-300"
              href={`${base}/${venue.slug}`}
            >
              {venue.name}
            </Link>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {venue.publisherName}
              {issn ? ` · ISSN ${issn}` : ""}
            </p>
            <div className="mt-4 space-y-2 border-t border-[var(--card-border)] pt-4 text-sm">
              <Link
                className="block font-medium text-blue-700 underline-offset-2 hover:underline dark:text-blue-300"
                href={`${base}/${venue.slug}/archive`}
              >
                {venue.type === "JOURNAL" ? "All issues" : "All papers"}
              </Link>
              <Link
                className="block font-medium text-blue-700 underline-offset-2 hover:underline dark:text-blue-300"
                href={`${base}/${venue.slug}/guidelines`}
              >
                Author guidelines
              </Link>
            </div>
          </section>
        </aside>
      </div>

      <VenueImprint venue={venue} />
    </main>
  );
}
