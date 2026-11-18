import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ExternalLink, FileText, Lock } from "lucide-react";

import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/db";
import { buildNoindexMetadata } from "@/lib/seo";
import { formatDate } from "@/utils/date";
import { formatFileSize } from "@/lib/format";
import { buildAuthorList } from "@/lib/publishing/citations";
import { canAuthorWithdraw } from "@/lib/publishing/transitions";
import {
  MANUSCRIPT_EVENT_LABELS,
  MANUSCRIPT_STATUS_LABELS,
} from "@/lib/publishing/labels";
import { ManuscriptStatusBadge } from "@/components/workspace/ManuscriptStatusBadge";
import { WithdrawSubmissionButton } from "@/components/workspace/WithdrawSubmissionButton";

export const metadata: Metadata = buildNoindexMetadata(
  "Submission - Workspace - ScholarBase",
);

const VENUE_TYPE_LABELS = {
  JOURNAL: "Journal",
  CONFERENCE: "Conference",
} as const;

/**
 * One submission, as its author sees it.
 *
 * The page is the author's record: the metadata they entered, the bytes they
 * uploaded, and the append-only event log editors write to. Only the owner can
 * read it; an editor has the desk view, not this route.
 */
export default async function SubmissionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const manuscript = await prisma.manuscript.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      abstract: true,
      keywords: true,
      coAuthors: true,
      status: true,
      round: true,
      createdAt: true,
      doi: true,
      isbn: true,
      volume: true,
      issue: true,
      firstPage: true,
      lastPage: true,
      publishedAt: true,
      authorId: true,
      venue: {
        select: { slug: true, name: true, type: true, isPublished: true },
      },
      author: { select: { name: true, orcidUrl: true } },
      originalManuscript: {
        select: {
          id: true,
          title: true,
          venue: { select: { name: true } },
        },
      },
      files: {
        orderBy: [{ round: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          round: true,
          kind: true,
          fileName: true,
          mimeType: true,
          sizeBytes: true,
          sha256: true,
          createdAt: true,
        },
      },
      events: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          type: true,
          note: true,
          createdAt: true,
          toStatus: true,
          actor: { select: { name: true } },
          targetVenue: { select: { name: true } },
        },
      },
    },
  });

  if (!manuscript || manuscript.authorId !== user.id) notFound();

  const authors = buildAuthorList(
    { name: manuscript.author.name, orcidUrl: manuscript.author.orcidUrl },
    manuscript.coAuthors,
  );
  const keywords = (manuscript.keywords ?? "")
    .split(",")
    .map((keyword) => keyword.trim())
    .filter(Boolean);

  const isPublished = manuscript.status === "PUBLISHED";
  const venueBase = manuscript.venue.type === "JOURNAL" ? "/sbj" : "/sbc";
  const publicArticleHref = manuscript.venue.isPublished
    ? `${venueBase}/${manuscript.venue.slug}/article/${manuscript.id}`
    : null;
  const venueHref = manuscript.venue.isPublished
    ? `${venueBase}/${manuscript.venue.slug}`
    : null;

  return (
    <main>
      <Link
        href="/workspace/submissions"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        All submissions
      </Link>

      <header className="mt-4">
        <div className="flex flex-wrap items-center gap-2">
          <ManuscriptStatusBadge status={manuscript.status} />
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {VENUE_TYPE_LABELS[manuscript.venue.type]}
          </span>
          {venueHref ? (
            <Link
              href={venueHref}
              className="text-xs font-medium text-blue-700 underline-offset-2 hover:underline dark:text-blue-300"
            >
              {manuscript.venue.name}
            </Link>
          ) : (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {manuscript.venue.name}
            </span>
          )}
        </div>
        <h1 className="sb-heading mt-2 text-2xl break-words">
          {manuscript.title}
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Submitted {formatDate(manuscript.createdAt)}
          {` · ${manuscript.round === 0 ? "Initial submission" : `Revision round ${manuscript.round}`}`}
        </p>

        {isPublished && publicArticleHref ? (
          <Link
            href={publicArticleHref}
            className="sb-button-primary mt-4 inline-flex items-center gap-1.5"
          >
            View published article
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        ) : null}
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-6">
          <section aria-labelledby="authors-heading" className="sb-card">
            <h2
              id="authors-heading"
              className="text-base font-semibold text-slate-950 dark:text-slate-50"
            >
              Authors
            </h2>
            <ol className="mt-3 space-y-3">
              {authors.map((author, index) => (
                <li key={`${author.name}-${index}`} className="flex gap-3">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {author.name}
                      {index === 0 ? (
                        <span className="ml-2 rounded-full border border-[var(--card-border)] px-2 py-0.5 text-[11px] font-normal text-slate-500 dark:text-slate-400">
                          Corresponding author
                        </span>
                      ) : null}
                    </p>
                    {author.affiliation ? (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {author.affiliation}
                      </p>
                    ) : null}
                    {author.orcid ? (
                      <a
                        href={`https://orcid.org/${author.orcid}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-700 underline-offset-2 hover:underline dark:text-blue-300"
                      >
                        ORCID {author.orcid}
                      </a>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="abstract-heading" className="sb-card">
            <h2
              id="abstract-heading"
              className="text-base font-semibold text-slate-950 dark:text-slate-50"
            >
              Abstract
            </h2>
            <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-700 dark:text-slate-300">
              {manuscript.abstract || "No abstract recorded."}
            </p>

            {keywords.length > 0 ? (
              <>
                <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Keywords
                </h3>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {keywords.map((keyword) => (
                    <li
                      key={keyword}
                      className="rounded-full border border-[var(--card-border)] px-2.5 py-1 text-xs text-slate-600 dark:text-slate-300"
                    >
                      {keyword}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </section>

          <section aria-labelledby="files-heading" className="sb-card">
            <h2
              id="files-heading"
              className="text-base font-semibold text-slate-950 dark:text-slate-50"
            >
              Files
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              The PDF is the version of record. It is stored privately and
              served only through a short-lived signed link.
            </p>
            <ul className="mt-3 space-y-3">
              {manuscript.files.map((file) => (
                <li
                  key={file.id}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-[var(--card-border)] p-3"
                >
                  <div className="min-w-0">
                    <p className="break-all text-sm font-medium text-slate-900 dark:text-slate-100">
                      {file.fileName}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {file.kind === "MANUSCRIPT" ? "Manuscript" : file.kind}
                      {` · Round ${file.round}`}
                      {formatFileSize(file.sizeBytes)
                        ? ` · ${formatFileSize(file.sizeBytes)}`
                        : ""}
                      {` · ${formatDate(file.createdAt)}`}
                    </p>
                    <p className="mt-1 font-mono text-[11px] text-slate-400 dark:text-slate-500">
                      SHA-256 {file.sha256.slice(0, 16)}…
                    </p>
                  </div>
                  {isPublished ? (
                    <a
                      href={`/api/papers/${manuscript.id}/file`}
                      className="sb-button-soft inline-flex items-center gap-1.5 text-xs"
                    >
                      <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                      Download PDF
                    </a>
                  ) : (
                    <a
                      href={`/api/manuscripts/${manuscript.id}/file`}
                      className="sb-button-soft inline-flex items-center gap-1.5 text-xs"
                    >
                      <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                      Download PDF
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="timeline-heading" className="sb-card">
            <h2
              id="timeline-heading"
              className="text-base font-semibold text-slate-950 dark:text-slate-50"
            >
              Timeline
            </h2>
            <ol className="mt-4 space-y-4">
              {manuscript.events.map((event) => (
                <li key={event.id} className="flex gap-3">
                  <span
                    className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-slate-400"
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {event.type === "STATUS_CHANGED" && event.toStatus
                        ? `Status changed to ${MANUSCRIPT_STATUS_LABELS[event.toStatus]}`
                        : MANUSCRIPT_EVENT_LABELS[event.type]}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {formatDate(event.createdAt)}
                      {event.actor?.name ? ` · ${event.actor.name}` : " · System"}
                    </p>
                    {event.note ? (
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                        {event.note}
                      </p>
                    ) : null}
                    {event.targetVenue ? (
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Target venue: {event.targetVenue.name}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="space-y-6">
          <section aria-labelledby="details-heading" className="sb-card">
            <h2
              id="details-heading"
              className="text-base font-semibold text-slate-950 dark:text-slate-50"
            >
              Details
            </h2>
            <dl className="mt-4 space-y-3 text-sm">
              <DetailRow label="Venue" value={manuscript.venue.name} />
              <DetailRow
                label="Type"
                value={VENUE_TYPE_LABELS[manuscript.venue.type]}
              />
              <DetailRow
                label="Submitted"
                value={formatDate(manuscript.createdAt)}
              />
              <DetailRow
                label="Round"
                value={manuscript.round === 0 ? "Initial" : String(manuscript.round)}
              />
              <DetailRow label="DOI" value={manuscript.doi} />
              <DetailRow label="ISBN" value={manuscript.isbn} />
              {manuscript.volume !== null ? (
                <DetailRow
                  label="Volume"
                  value={
                    manuscript.issue !== null
                      ? `${manuscript.volume}(${manuscript.issue})`
                      : String(manuscript.volume)
                  }
                />
              ) : null}
              {manuscript.firstPage ? (
                <DetailRow
                  label="Pages"
                  value={
                    manuscript.lastPage
                      ? `${manuscript.firstPage}–${manuscript.lastPage}`
                      : manuscript.firstPage
                  }
                />
              ) : null}
              {manuscript.publishedAt ? (
                <DetailRow
                  label="Published"
                  value={formatDate(manuscript.publishedAt)}
                />
              ) : null}
            </dl>
          </section>

          {manuscript.originalManuscript ? (
            <section aria-labelledby="origin-heading" className="sb-card">
              <h2
                id="origin-heading"
                className="text-base font-semibold text-slate-950 dark:text-slate-50"
              >
                Extended version
              </h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                {manuscript.originalManuscript.title}
              </p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {manuscript.originalManuscript.venue.name}
              </p>
              <Link
                href={`/workspace/submissions/${manuscript.originalManuscript.id}`}
                className="mt-3 inline-flex text-xs font-medium text-blue-700 underline-offset-2 hover:underline dark:text-blue-300"
              >
                View the conference paper
              </Link>
            </section>
          ) : null}

          {canAuthorWithdraw(manuscript.status) ? (
            <section aria-labelledby="withdraw-heading" className="sb-card">
              <h2
                id="withdraw-heading"
                className="text-base font-semibold text-slate-950 dark:text-slate-50"
              >
                Withdraw
              </h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Withdrawing notifies the editor and closes this submission. It
                stays in your workspace as a record.
              </p>
              <div className="mt-3">
                <WithdrawSubmissionButton manuscriptId={manuscript.id} />
              </div>
            </section>
          ) : null}
        </aside>
      </div>

      {manuscript.events.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">
          Editorial activity will appear here as the manuscript moves through
          review.
        </p>
      ) : null}
    </main>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  if (!value) return null;

  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="text-right font-medium break-words text-slate-900 dark:text-slate-100">
        {value}
      </dd>
    </div>
  );
}
