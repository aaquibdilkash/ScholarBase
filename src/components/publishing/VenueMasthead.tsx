import Link from "next/link";
import Image from "next/image";

import { formatIssn } from "@/lib/publishing/identifiers";
import type { PublicVenue } from "@/lib/publishing/public";

/**
 * Shared chrome for every public venue page.
 *
 * The masthead is the block ISSN and DOAJ reviewers look at first: title,
 * publisher, ISSN, frequency, and a named editor, above the fold. It is
 * deliberately one component so a journal page, a conference page, and an
 * article page cannot show three different versions of the same identity.
 */

export function venueBasePath(type: PublicVenue["type"]): "/sbj" | "/sbc" {
  return type === "JOURNAL" ? "/sbj" : "/sbc";
}

export function venueLabel(type: PublicVenue["type"]): string {
  return type === "JOURNAL" ? "Research journal" : "Conference proceedings";
}

/** Hyphenated when the stored value validates, otherwise shown verbatim. */
export function displayIssn(value: string | null | undefined): string | null {
  if (!value) return null;
  return formatIssn(value) || value;
}

export type VenueTab = "overview" | "guidelines" | "archive";

function tabLabels(type: PublicVenue["type"]): Record<VenueTab, string> {
  return {
    overview: "Overview",
    guidelines: type === "JOURNAL" ? "Author guidelines" : "Submission guidelines",
    archive: type === "JOURNAL" ? "Archive" : "Papers",
  };
}

export function VenueMasthead({
  venue,
  preview,
  activeTab = "overview",
  trail,
}: {
  venue: PublicVenue;
  preview: boolean;
  activeTab?: VenueTab;
  /** Extra breadcrumb items after the venue name (e.g. the article title). */
  trail?: string;
}) {
  const base = venueBasePath(venue.type);
  const issn = displayIssn(venue.issn);
  const eissn = displayIssn(venue.eissn);

  const identity = [
    `Published by ${venue.publisherName}`,
    issn ? `ISSN ${issn}` : null,
    eissn ? `e-ISSN ${eissn}` : null,
    venue.frequency ? `Published ${venue.frequency.toLowerCase()}` : null,
  ].filter(Boolean);

  return (
    <header>
      <nav
        aria-label="Breadcrumb"
        className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400"
      >
        <Link className="hover:text-slate-900 dark:hover:text-slate-100" href="/">
          ScholarBase
        </Link>
        <span aria-hidden="true">/</span>
        <Link className="hover:text-slate-900 dark:hover:text-slate-100" href={base}>
          {venue.type === "JOURNAL" ? "Journals" : "Conferences"}
        </Link>
        <span aria-hidden="true">/</span>
        <span className="text-slate-700 dark:text-slate-300">{venue.name}</span>
        {trail ? (
          <>
            <span aria-hidden="true">/</span>
            <span className="line-clamp-1 text-slate-700 dark:text-slate-300">{trail}</span>
          </>
        ) : null}
      </nav>

      <div className="mt-4 border-b border-[var(--card-border)] pb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700 dark:text-blue-300">
          {venueLabel(venue.type)}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 dark:text-slate-50 sm:text-4xl">
          {venue.name}
        </h1>
        {venue.coverImageUrl ? <Image src={venue.coverImageUrl} alt="" width={960} height={240} unoptimized className="mt-5 h-40 w-full rounded-2xl object-cover sm:h-52" /> : null}
        <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400">
          {identity.join(" · ")}
        </p>

        {preview ? (
          <p
            role="status"
            className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-900/20 dark:text-amber-200"
          >
            Editor preview — this venue is not published, so it is hidden from
            search engines and the sitemap.
          </p>
        ) : null}
      </div>

      <nav aria-label="Venue sections" className="mt-4 flex flex-wrap gap-1">
        {(["overview", "guidelines", "archive"] as const).map((tab) => {
          const href =
            tab === "overview" ? `${base}/${venue.slug}` : `${base}/${venue.slug}/${tab}`;
          const active = tab === activeTab;

          return (
            <Link
              key={tab}
              href={href}
              aria-current={active ? "page" : undefined}
              className={
                active
                  ? "rounded-full bg-slate-900 px-3.5 py-1.5 text-sm font-semibold text-white dark:bg-slate-100 dark:text-slate-900"
                  : "rounded-full px-3.5 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              }
            >
              {tabLabels(venue.type)[tab]}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}

/**
 * Footer imprint. Every venue page ends with the publisher identity, because
 * "who publishes this" must be answerable from any entry point, including one
 * reached from a search result deep in the archive.
 */
export function VenueImprint({ venue }: { venue: PublicVenue }) {
  const issn = displayIssn(venue.issn);
  const eissn = displayIssn(venue.eissn);

  return (
    <footer className="mt-12 border-t border-[var(--card-border)] pt-6 text-xs leading-6 text-slate-500 dark:text-slate-400">
      <p className="font-medium text-slate-700 dark:text-slate-300">{venue.name}</p>
      <p>
        Published by {venue.publisherName}.{" "}
        {issn ? `ISSN ${issn}. ` : ""}
        {eissn ? `e-ISSN ${eissn}. ` : ""}
        {venue.licenseUrl ? (
          <a
            className="underline hover:text-slate-900 dark:hover:text-slate-100"
            href={venue.licenseUrl}
            rel="license noopener noreferrer"
            target="_blank"
          >
            Open access under CC BY 4.0
          </a>
        ) : null}
      </p>
      {venue.contactEmail ? (
        <p>
          Editorial correspondence:{" "}
          <a
            className="underline hover:text-slate-900 dark:hover:text-slate-100"
            href={`mailto:${venue.contactEmail}`}
          >
            {venue.contactEmail}
          </a>
        </p>
      ) : null}
    </footer>
  );
}

export function VenueSection({
  id,
  title,
  description,
  children,
  className = "",
}: {
  id?: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={`sb-card ${className}`}>
      <h2 className="text-xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
        {title}
      </h2>
      {description ? (
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{description}</p>
      ) : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}
