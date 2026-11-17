import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ChevronRight,
  FilePlus2,
  FileText,
  MailOpen,
  TrendingUp,
  CheckCircle2,
} from "lucide-react";

import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/db";
import { formatDate } from "@/utils/date";
import { listAuthorInvitations } from "@/lib/publishing/invitations";
import { ManuscriptStatusBadge } from "@/components/workspace/ManuscriptStatusBadge";
import {
  TransferInvitationCard,
  type AuthorInvitationView,
} from "@/components/workspace/TransferInvitationCard";

const VENUE_TYPE_LABELS = {
  JOURNAL: "Journal",
  CONFERENCE: "Conference",
} as const;

/**
 * The author's own record: every manuscript they own, plus conference
 * invitations to submit an extended version to a journal.
 *
 * Invitation state comes from `listAuthorInvitations`: an invitation is open
 * until the author declines (`TRANSFER_DECLINED`) or a live journal clone
 * exists. A completed transfer is not listed twice — it already appears in the
 * manuscript list below.
 */
export default async function SubmissionsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [manuscripts, invitations] = await Promise.all([
    prisma.manuscript.findMany({
      where: { authorId: user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
        venue: { select: { name: true, type: true } },
      },
    }),
    listAuthorInvitations(user.id),
  ]);

  const visibleInvitations: AuthorInvitationView[] = invitations
    .filter((invitation) => invitation.state !== "SUBMITTED")
    .map((invitation) => ({
      eventId: invitation.eventId,
      manuscriptTitle: invitation.manuscriptTitle,
      sourceVenueName: invitation.sourceVenueName,
      targetVenueName: invitation.targetVenueName,
      invitedByName: invitation.invitedByName,
      invitedOn: formatDate(invitation.invitedOn),
      state: invitation.state === "DECLINED" ? "DECLINED" : "OPEN",
    }));

  const openCount = visibleInvitations.filter(
    (invitation) => invitation.state === "OPEN",
  ).length;
  const inProgress = manuscripts.filter(
    (manuscript) =>
      manuscript.status === "SUBMITTED" ||
      manuscript.status === "UNDER_REVIEW" ||
      manuscript.status === "REVISION_REQUIRED",
  ).length;
  const published = manuscripts.filter(
    (manuscript) => manuscript.status === "PUBLISHED",
  ).length;

  return (
    <main>
      <header className="mb-8">
        <h1 className="sb-heading text-2xl">Your submissions</h1>
        <p className="sb-subtitle mt-2 max-w-2xl text-sm">
          Every paper you have submitted, its status, and any invitation to
          extend a conference paper into a journal.
        </p>
      </header>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Manuscripts"
          value={manuscripts.length}
          icon={<FileText className="h-4 w-4" aria-hidden="true" />}
        />
        <StatCard
          label="In progress"
          value={inProgress}
          icon={<TrendingUp className="h-4 w-4" aria-hidden="true" />}
        />
        <StatCard
          label="Published"
          value={published}
          icon={<CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
        />
        <StatCard
          label="Open invitations"
          value={openCount}
          icon={<MailOpen className="h-4 w-4" aria-hidden="true" />}
        />
      </dl>

      {visibleInvitations.length > 0 && (
        <section aria-labelledby="invitations-heading" className="mt-8">
          <h2 id="invitations-heading" className="sb-heading text-lg">
            Journal invitations
            {openCount > 0 ? (
              <span className="ml-2 text-sm font-normal text-slate-500 dark:text-slate-400">
                {openCount} open
              </span>
            ) : null}
          </h2>
          <div className="mt-3 space-y-3">
            {visibleInvitations.map((invitation) => (
              <TransferInvitationCard
                key={invitation.eventId}
                invitation={invitation}
              />
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="manuscripts-heading" className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="manuscripts-heading" className="sb-heading text-lg">
            Manuscripts
          </h2>
          {manuscripts.length > 0 ? (
            <Link
              href="/workspace/submissions/new"
              className="sb-button-soft inline-flex items-center gap-1.5 text-sm"
            >
              <FilePlus2 className="h-3.5 w-3.5" aria-hidden="true" />
              New submission
            </Link>
          ) : null}
        </div>

        {manuscripts.length === 0 ? (
          <div className="sb-card mt-3 text-center">
            <FilePlus2
              className="mx-auto h-8 w-8 text-slate-400"
              aria-hidden="true"
            />
            <p className="mt-3 text-sm font-medium text-slate-900 dark:text-slate-100">
              No manuscript yet
            </p>
            <p className="mx-auto mt-1 max-w-md text-sm text-slate-600 dark:text-slate-400">
              Start a submission and the editor is notified. Your status timeline
              stays here from submission to publication.
            </p>
            <Link
              href="/workspace/submissions/new"
              className="sb-button-primary mt-4 inline-flex items-center gap-1.5"
            >
              <FilePlus2 className="h-4 w-4" aria-hidden="true" />
              Start a submission
            </Link>
          </div>
        ) : (
          <ul className="mt-3 space-y-3">
            {manuscripts.map((manuscript) => (
              <li key={manuscript.id}>
                <Link
                  href={`/workspace/submissions/${manuscript.id}`}
                  className="sb-card sb-card-hover flex flex-wrap items-start justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-950 dark:text-slate-50">
                      {manuscript.title}
                    </p>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                      {manuscript.venue.name}
                      {` · ${VENUE_TYPE_LABELS[manuscript.venue.type]}`}
                      {` · submitted ${formatDate(manuscript.createdAt)}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <ManuscriptStatusBadge status={manuscript.status} />
                    <ChevronRight
                      className="h-4 w-4 text-slate-400"
                      aria-hidden="true"
                    />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="sb-card py-3">
      <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        <span className="text-slate-400 dark:text-slate-500">{icon}</span>
        {label}
      </dt>
      <dd className="mt-1 text-2xl font-semibold tabular-nums text-slate-950 dark:text-slate-50">
        {value}
      </dd>
    </div>
  );
}
