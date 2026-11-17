import { redirect } from "next/navigation";
import type { EditorialRoleTitle } from "@prisma/client";

import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/db";
import { formatDate } from "@/utils/date";
import { EDITORIAL_ROLE_LABELS } from "@/lib/publishing/labels";
import {
  INVITATION_EVENT_TYPES,
  latestInvitationByTarget,
} from "@/lib/publishing/invitations";
import {
  TransferInvitePanel,
  type TransferCandidate,
} from "@/components/workspace/TransferInvitePanel";

const TRANSFER_ROLES: readonly EditorialRoleTitle[] = [
  "EDITOR_IN_CHIEF",
  "TRACK_CHAIR",
];

/**
 * Conference editorial desk for the Golden Flow.
 *
 * Shows accepted proceedings papers at conferences where the signed-in user
 * holds a transfer-capable seat, and lets them *invite* the author to a journal.
 * There is deliberately no chair-side "move" control: the author creates the
 * journal submission, so provenance and consent are preserved.
 */
export default async function EditorialPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const roles = await prisma.editorialRole.findMany({
    where: { userId: user.id },
    select: {
      roleTitle: true,
      venue: { select: { id: true, name: true, type: true } },
    },
  });

  const conferenceIds = [
    ...new Set(
      roles
        .filter(
          (role) =>
            role.venue.type === "CONFERENCE" &&
            TRANSFER_ROLES.includes(role.roleTitle),
        )
        .map((role) => role.venue.id),
    ),
  ];

  if (conferenceIds.length === 0) {
    return (
      <main>
        <header className="mb-6">
          <h1 className="sb-heading text-2xl">Editorial</h1>
          <p className="sb-subtitle mt-2 text-sm">
            Assign reviewers, decide, and invite accepted conference papers to a
            journal.
          </p>
        </header>
        <p className="sb-card text-sm text-slate-500 dark:text-slate-400">
          You do not hold an Editor-in-Chief or Track Chair seat at a conference.
          A platform administrator can grant one from the Administration page.
        </p>
      </main>
    );
  }

  const [manuscripts, journals] = await Promise.all([
    prisma.manuscript.findMany({
      where: {
        venueId: { in: conferenceIds },
        status: "ACCEPTED_PROCEDINGS",
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        author: { select: { name: true, email: true } },
        venue: { select: { name: true } },
        events: {
          where: { type: { in: [...INVITATION_EVENT_TYPES] } },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            type: true,
            createdAt: true,
            targetVenueId: true,
            targetVenue: { select: { id: true, name: true } },
          },
        },
      },
    }),
    prisma.venue.findMany({
      where: { type: "JOURNAL", isPublished: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const manuscriptIds = manuscripts.map((manuscript) => manuscript.id);
  const clones = manuscriptIds.length
    ? await prisma.manuscript.findMany({
        where: {
          originalManuscriptId: { in: manuscriptIds },
          status: { not: "WITHDRAWN" },
        },
        select: { originalManuscriptId: true, venueId: true },
      })
    : [];

  const transferredByManuscript = new Map<string, string[]>();
  for (const clone of clones) {
    if (!clone.originalManuscriptId) continue;
    const list = transferredByManuscript.get(clone.originalManuscriptId) ?? [];
    list.push(clone.venueId);
    transferredByManuscript.set(clone.originalManuscriptId, list);
  }

  const candidates: TransferCandidate[] = manuscripts.map((manuscript) => ({
    id: manuscript.id,
    title: manuscript.title,
    authorName: manuscript.author.name,
    authorEmail: manuscript.author.email,
    conferenceName: manuscript.venue.name,
    invitations: [...latestInvitationByTarget(manuscript.events).values()].flatMap(
      (event) =>
        event.targetVenue
          ? [
              {
                id: event.id,
                venueId: event.targetVenue.id,
                journalName: event.targetVenue.name,
                invitedOn: formatDate(event.createdAt),
                declined: event.type === "TRANSFER_DECLINED",
              },
            ]
          : [],
    ),
    transferredVenueIds: transferredByManuscript.get(manuscript.id) ?? [],
  }));

  return (
    <main>
      <header className="mb-6">
        <h1 className="sb-heading text-2xl">Editorial</h1>
        <p className="sb-subtitle mt-2 text-sm">
          Accepted conference papers can be invited to a journal. The author
          decides whether to submit an extended version.
        </p>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          You hold:{" "}
          {roles
            .filter((role) =>
              TRANSFER_ROLES.includes(role.roleTitle),
            )
            .map(
              (role) =>
                `${EDITORIAL_ROLE_LABELS[role.roleTitle]} at ${role.venue.name}`,
            )
            .join(" · ")}
        </p>
      </header>

      <TransferInvitePanel candidates={candidates} journals={journals} />
    </main>
  );
}
