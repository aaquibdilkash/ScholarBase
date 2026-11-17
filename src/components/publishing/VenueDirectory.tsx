import Link from "next/link";

import { displayIssn } from "@/components/publishing/VenueMasthead";
import { plainText } from "@/lib/schema";
import type { VenueType } from "@/lib/publishing/public";

type DirectoryEntry = {
  slug: string;
  name: string;
  aimsAndScope: string | null;
  issn: string | null;
  eissn: string | null;
  frequency: string | null;
  editorName: string | null;
  launchedAt: Date | null;
  _count: { manuscripts: number };
};

/**
 * Directory of published venues.
 *
 * Demo venues and unpublished venues are absent by construction — the query
 * filters them — because a directory that lists an empty test journal is worse
 * than a short directory.
 */
export function VenueDirectory({
  type,
  venues,
}: {
  type: VenueType;
  venues: DirectoryEntry[];
}) {
  const isJournal = type === "JOURNAL";
  const base = isJournal ? "/sbj" : "/sbc";

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-slate-50 sm:text-4xl">
          {isJournal ? "Research journals" : "Conferences"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400 sm:text-base">
          {isJournal
            ? "Open-access journals published by ScholarBase, with their editorial boards, aims and scope, and full archives."
            : "Conference proceedings published by ScholarBase, with their committees, volumes, and ISBN record."}
        </p>
      </header>

      {venues.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-[var(--card-border)] px-4 py-8 text-sm text-slate-500 dark:text-slate-400">
          {isJournal
            ? "No journal has been published yet."
            : "No conference has been published yet."}
        </p>
      ) : (
        <ul className="mt-8 space-y-4">
          {venues.map((venue) => {
            const issn = displayIssn(venue.issn);
            const eissn = displayIssn(venue.eissn);
            const scope = venue.aimsAndScope ? plainText(venue.aimsAndScope) : "";

            return (
              <li key={venue.slug} className="sb-card sb-card-hover">
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                  <h2 className="min-w-0 flex-1 text-lg font-semibold tracking-tight text-slate-950 dark:text-slate-50">
                    <Link
                      className="underline-offset-2 hover:underline"
                      href={`${base}/${venue.slug}`}
                    >
                      {venue.name}
                    </Link>
                  </h2>
                  <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
                    {venue._count.manuscripts} published article
                    {venue._count.manuscripts === 1 ? "" : "s"}
                  </span>
                </div>

                {scope ? (
                  <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600 dark:text-slate-400">
                    {scope}
                  </p>
                ) : null}

                <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                  {issn ? <span>ISSN {issn}</span> : null}
                  {eissn ? <span>e-ISSN {eissn}</span> : null}
                  {venue.frequency ? <span>{venue.frequency}</span> : null}
                  {venue.editorName ? (
                    <span>Editor: {venue.editorName}</span>
                  ) : null}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
