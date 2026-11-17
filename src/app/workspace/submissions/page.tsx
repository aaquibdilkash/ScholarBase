import { redirect } from "next/navigation";

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

  return (
    <main>
      <header className="mb-6">
        <h1 className="sb-heading text-2xl">Your submissions</h1>
        <p className="mt-2 text-base text-slate-300 dark:text-slate-300">
          Every paper you have submitted, and any invitation to extend a
          conference paper into a journal.
        </p>
      </header>

      {visibleInvitations.length > 0 && (
        <section aria-labelledby="invitations-heading" className="mb-6">
          <h2 id="invitations-heading" className="sb-heading text-lg">
            Journal invitations
            {openCount > 0 ? (
                <span className="ml-2 text-sm font-normal text-slate-300 dark:text-slate-300">
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

      <section aria-labelledby="manuscripts-heading">
        <h2 id="manuscripts-heading" className="sb-heading text-lg">
          Manuscripts
        </h2>

        {manuscripts.length === 0 ? (
          <p className="sb-card mt-3 text-sm text-slate-300 dark:text-slate-300">
            You have not submitted a manuscript yet. Conference calls and journal
            submission forms appear here once they open.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {manuscripts.map((manuscript) => (
              <li key={manuscript.id} className="sb-card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{manuscript.title}</p>
                    <p className="mt-1 text-sm text-slate-300 dark:text-slate-300">
                      {manuscript.venue.name}
                      {` · ${VENUE_TYPE_LABELS[manuscript.venue.type]}`}
                      {` · submitted ${formatDate(manuscript.createdAt)}`}
                    </p>
                  </div>
                  <ManuscriptStatusBadge status={manuscript.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
