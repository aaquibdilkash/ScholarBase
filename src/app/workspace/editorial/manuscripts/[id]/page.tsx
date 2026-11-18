import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ExternalLink, FileText } from "lucide-react";

import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/db";
import { buildNoindexMetadata } from "@/lib/seo";
import { formatDate } from "@/utils/date";
import { formatFileSize } from "@/lib/format";
import { buildAuthorList } from "@/lib/publishing/citations";
import { getManuscriptPermissions } from "@/lib/publishing/access";
import {
  EDITORIAL_ROLE_LABELS,
  MANUSCRIPT_EVENT_LABELS,
  MANUSCRIPT_STATUS_LABELS,
  REVIEW_DECISION_LABELS,
} from "@/lib/publishing/labels";
import { reviewReportBody } from "@/lib/publishing/review-reports";
import { findReviewerCandidates } from "@/lib/publishing/reviewer-suggestions";
import {
  canEditorSetStatus,
  isStatusAllowedForVenue,
} from "@/lib/publishing/permissions";
import { isZenodoConfigured } from "@/lib/publishing/zenodo";
import { nextStatuses } from "@/lib/publishing/transitions";
import { ManuscriptStatusBadge } from "@/components/workspace/ManuscriptStatusBadge";
import { AssignReviewerPanel } from "@/components/workspace/AssignReviewerPanel";
import { ReviewReportForm } from "@/components/workspace/ReviewReportForm";
import { DecisionPanel } from "@/components/workspace/DecisionPanel";
import { DoiPanel } from "@/components/workspace/DoiPanel";

export const metadata: Metadata = buildNoindexMetadata(
  "Review workspace - ScholarBase",
);

const ASSIGNABLE = ["SUBMITTED", "UNDER_REVIEW"] as const;
const REPORTABLE = ["UNDER_REVIEW", "REVISION_REQUIRED"] as const;

/**
 * One paper's review workspace.
 *
 * Two audiences share the page because they need the same context (title,
 * abstract, the PDF, the timeline): the desk, which assigns reviewers and
 * records the decision, and the assigned reviewer, who only ever sees their own
 * report form. Sections are gated per capability — a reviewer never receives
 * another reviewer's report or the decision controls.
 *
 * The author does not see this route; their record lives at
 * `/workspace/submissions/[id]`. Keeping them apart is what lets this page show
 * reviewer names at all.
 */
export default async function EditorialManuscriptPage({
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
      authorId: true,
      venueId: true,
      volume: true,
      issue: true,
      firstPage: true,
      lastPage: true,
      publishedAt: true,
      doi: true,
      doiStatus: true,
      venue: { select: { name: true, slug: true, type: true, isPublished: true } },
      author: { select: { name: true, email: true, orcidUrl: true } },
      files: {
        orderBy: [{ round: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          round: true,
          kind: true,
          fileName: true,
          sizeBytes: true,
          createdAt: true,
        },
      },
      reviews: {
        orderBy: [{ round: "desc" }, { assignedAt: "asc" }],
        select: {
          id: true,
          round: true,
          score: true,
          decision: true,
          inlineComments: true,
          isCompleted: true,
          assignedAt: true,
          completedAt: true,
          reviewer: { select: { id: true, name: true, handle: true } },
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
        },
      },
    },
  });

  if (!manuscript) notFound();

  const permissions = await getManuscriptPermissions(user.id, manuscript);
  if (!permissions.isEditor && !permissions.isReviewer) notFound();

  const authors = buildAuthorList(
    { name: manuscript.author.name, orcidUrl: manuscript.author.orcidUrl },
    manuscript.coAuthors,
  );
  const keywords = (manuscript.keywords ?? "")
    .split(",")
    .map((keyword) => keyword.trim())
    .filter(Boolean);

  const actor = { roles: permissions.roles, isAdmin: permissions.isAdmin };
  const canMintDoi = canEditorSetStatus(actor, "PUBLISHED");
  const zenodoConfigured = isZenodoConfigured();
  const decisionOptions = nextStatuses(manuscript.status).filter(
    (status) =>
      // Publishing records the citation locator; withdrawal belongs to the
      // author. Neither is an editorial decision.
      status !== "PUBLISHED" &&
      status !== "WITHDRAWN" &&
      canEditorSetStatus(actor, status) &&
      isStatusAllowedForVenue(status, manuscript.venue.type),
  );

  const ownTask = manuscript.reviews.find(
    (review) => review.reviewer.id === user.id && review.round === manuscript.round,
  );
  // A reviewer reads their own report; the desk reads every report.
  const visibleReviews = permissions.isEditor
    ? manuscript.reviews
    : manuscript.reviews.filter((review) => review.reviewer.id === user.id);

  const completedReports = manuscript.reviews.filter(
    (review) => review.isCompleted,
  ).length;
  const canAssign = ASSIGNABLE.includes(
    manuscript.status as (typeof ASSIGNABLE)[number],
  );
  const canReport = REPORTABLE.includes(
    manuscript.status as (typeof REPORTABLE)[number],
  );

  const reviewerSuggestions =
    permissions.isEditor && canAssign
      ? await findReviewerCandidates({
          keywords,
          authorId: manuscript.authorId,
          excludeIds: manuscript.reviews.map((review) => review.reviewer.id),
        })
      : [];

  const publishedHref =
    manuscript.status === "PUBLISHED" && manuscript.venue.isPublished
      ? `/${manuscript.venue.type === "JOURNAL" ? "sbj" : "sbc"}/${manuscript.venue.slug}/article/${manuscript.id}`
      : null;

  return (
    <main>
      <Link
        href="/workspace/editorial"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        Editorial desk
      </Link>

      <header className="mt-4">
        <div className="flex flex-wrap items-center gap-2">
          <ManuscriptStatusBadge status={manuscript.status} />
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {manuscript.venue.type === "JOURNAL" ? "Journal" : "Conference"}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {manuscript.venue.name}
          </span>
        </div>
        <h1 className="sb-heading mt-2 text-2xl break-words">{manuscript.title}</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          {manuscript.author.name ?? manuscript.author.email}
          {` · submitted ${formatDate(manuscript.createdAt)}`}
          {` · ${manuscript.round === 0 ? "initial submission" : `revision round ${manuscript.round}`}`}
          {` · ${completedReports} completed ${completedReports === 1 ? "report" : "reports"}`}
        </p>
        {permissions.isEditor ? (
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Your seat:{" "}
            {permissions.isAdmin
              ? "platform administrator"
              : permissions.roles
                  .map((role) => EDITORIAL_ROLE_LABELS[role])
                  .join(" · ")}
          </p>
        ) : (
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            You are an assigned reviewer. Only your own report is visible here.
          </p>
        )}
        {publishedHref ? (
          <Link
            href={publishedHref}
            className="sb-button-primary mt-4 inline-flex items-center gap-1.5"
          >
            View published article
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        ) : null}
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          {canReport && permissions.isReviewer ? (
            <section aria-labelledby="report-heading" className="sb-card">
              <h2
                id="report-heading"
                className="text-base font-semibold text-slate-950 dark:text-slate-50"
              >
                Your report
              </h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                The author sees that a report landed and the decision letter, not
                your name or this text.
              </p>
              <div className="mt-4">
                <ReviewReportForm
                  manuscriptId={manuscript.id}
                  initial={
                    ownTask
                      ? {
                          score: ownTask.score,
                          decision: ownTask.decision,
                          comments: reviewReportBody(ownTask.inlineComments),
                          isCompleted: ownTask.isCompleted,
                        }
                      : undefined
                  }
                />
              </div>
            </section>
          ) : null}

          <section aria-labelledby="authors-heading" className="sb-card">
            <h2
              id="authors-heading"
              className="text-base font-semibold text-slate-950 dark:text-slate-50"
            >
              Authors
            </h2>
            <ol className="mt-3 space-y-2">
              {authors.map((author, index) => (
                <li key={`${author.name}-${index}`} className="text-sm">
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {author.name}
                  </span>
                  {index === 0 ? (
                    <span className="ml-2 rounded-full border border-[var(--card-border)] px-2 py-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                      Corresponding
                    </span>
                  ) : null}
                  {author.affiliation ? (
                    <span className="block text-xs text-slate-500 dark:text-slate-400">
                      {author.affiliation}
                    </span>
                  ) : null}
                  {author.orcid ? (
                    <a
                      className="block text-xs text-blue-700 underline-offset-2 hover:underline dark:text-blue-300"
                      href={`https://orcid.org/${author.orcid}`}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      ORCID {author.orcid}
                    </a>
                  ) : null}
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
              <ul className="mt-3 flex flex-wrap gap-2">
                {keywords.map((keyword) => (
                  <li
                    className="rounded-full border border-[var(--card-border)] px-2.5 py-1 text-xs text-slate-600 dark:text-slate-300"
                    key={keyword}
                  >
                    {keyword}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          <section aria-labelledby="files-heading" className="sb-card">
            <h2
              id="files-heading"
              className="text-base font-semibold text-slate-950 dark:text-slate-50"
            >
              Files
            </h2>
            <ul className="mt-3 space-y-3">
              {manuscript.files.length === 0 ? (
                <li className="text-sm text-slate-500 dark:text-slate-400">
                  No file was uploaded.
                </li>
              ) : null}
              {manuscript.files.map((file) => (
                <li
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--card-border)] p-3"
                  key={file.id}
                >
                  <div className="min-w-0">
                    <p className="break-all text-sm font-medium text-slate-900 dark:text-slate-100">
                      {file.fileName}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {file.kind === "MANUSCRIPT" ? "Manuscript" : file.kind}
                      {` · round ${file.round}`}
                      {formatFileSize(file.sizeBytes)
                        ? ` · ${formatFileSize(file.sizeBytes)}`
                        : ""}
                    </p>
                  </div>
                  <a
                    className="sb-button-soft inline-flex items-center gap-1.5 text-xs"
                    href={`/api/manuscripts/${manuscript.id}/file`}
                  >
                    <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                    Download PDF
                  </a>
                </li>
              ))}
            </ul>
          </section>

          {permissions.isEditor ? (
            <section aria-labelledby="reports-heading" className="sb-card">
              <h2
                id="reports-heading"
                className="text-base font-semibold text-slate-950 dark:text-slate-50"
              >
                Reports
              </h2>
              {visibleReviews.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  No reviewer has been assigned yet.
                </p>
              ) : (
                <ul className="mt-3 divide-y divide-[var(--card-border)]">
                  {visibleReviews.map((review) => {
                    const body = reviewReportBody(review.inlineComments);
                    return (
                      <li className="py-3 first:pt-0 last:pb-0" key={review.id}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                            {review.reviewer.name ??
                              review.reviewer.handle ??
                              "Reviewer"}
                          </p>
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {review.isCompleted
                              ? `Reported ${review.completedAt ? formatDate(review.completedAt) : ""}`
                              : `Invited ${formatDate(review.assignedAt)} · awaiting report`}
                          </span>
                        </div>
                        {review.isCompleted ? (
                          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                            Score {review.score ?? "—"}/10
                            {review.decision
                              ? ` · ${REVIEW_DECISION_LABELS[review.decision]}`
                              : ""}
                            {review.round > 0 ? ` · round ${review.round}` : ""}
                          </p>
                        ) : null}
                        {body ? (
                          <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700 dark:text-slate-300">
                            {body}
                          </p>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          ) : null}

          {permissions.isEditor ? (
            <section aria-labelledby="decision-heading" className="sb-card">
              <h2
                id="decision-heading"
                className="text-base font-semibold text-slate-950 dark:text-slate-50"
              >
                Decision
              </h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Accepting or rejecting needs at least one completed report. A
                paper that never reached review is desk rejected instead.
              </p>
              <div className="mt-4">
                <DecisionPanel
                  manuscriptId={manuscript.id}
                  options={decisionOptions}
                />
              </div>
            </section>
          ) : null}

          <section aria-labelledby="timeline-heading" className="sb-card">
            <h2
              id="timeline-heading"
              className="text-base font-semibold text-slate-950 dark:text-slate-50"
            >
              Timeline
            </h2>
            <ol className="mt-4 space-y-4">
              {manuscript.events.map((event) => (
                <li className="flex gap-3" key={event.id}>
                  <span
                    aria-hidden="true"
                    className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-slate-400"
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
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="space-y-6">
          {permissions.isEditor ? (
            <section aria-labelledby="assign-heading" className="sb-card">
              <h2
                id="assign-heading"
                className="text-base font-semibold text-slate-950 dark:text-slate-50"
              >
                Reviewers
              </h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {manuscript.reviews.length === 0
                  ? "No reviewer yet."
                  : `${manuscript.reviews.length} assigned, ${completedReports} reported.`}
              </p>
              <div className="mt-4">
                <AssignReviewerPanel
                  disabledReason={
                    canAssign
                      ? undefined
                      : `A ${MANUSCRIPT_STATUS_LABELS[manuscript.status].toLowerCase()} manuscript cannot take a new reviewer.`
                  }
                  manuscriptId={manuscript.id}
                  suggestions={reviewerSuggestions}
                />
              </div>
            </section>
          ) : null}

          {manuscript.status === "PUBLISHED" && permissions.isEditor ? (
            <DoiPanel
              canMint={canMintDoi}
              configured={zenodoConfigured}
              doi={manuscript.doi}
              manuscriptId={manuscript.id}
              status={manuscript.doiStatus}
            />
          ) : null}

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
                value={manuscript.venue.type === "JOURNAL" ? "Journal" : "Conference"}
              />
              <DetailRow label="Submitted" value={formatDate(manuscript.createdAt)} />
              <DetailRow
                label="Round"
                value={manuscript.round === 0 ? "Initial" : String(manuscript.round)}
              />
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
              {manuscript.doi ? (
                <DetailRow label="DOI" value={manuscript.doi} />
              ) : null}
            </dl>
          </section>
        </aside>
      </div>
    </main>
  );
}

function DetailRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;

  return (
    <div className="flex justify-between gap-3">
      <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="text-right font-medium text-slate-900 dark:text-slate-100">
        {value}
      </dd>
    </div>
  );
}
