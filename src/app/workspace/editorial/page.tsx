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
import {
  PublishManuscriptPanel,
  type PublishCandidate,
} from "@/components/workspace/PublishManuscriptPanel";

const TRANSFER_ROLES: readonly EditorialRoleTitle[] = [
  "EDITOR_IN_CHIEF",
  "TRACK_CHAIR",
];

/**
 * Editorial desk.
 *
 * Two jobs live here because they share the same audience — someone holding an
 * editorial seat:
 *
 * 1. Publishing: an Editor-in-Chief of a journal or conference turns an
 *    accepted manuscript into a citable article (volume, issue, pages).
 * 2. Transfer: a conference editor invites the author of an accepted paper to
 *    submit an extended version to a journal. The author creates the journal
 *    row; nothing is moved on their behalf.
 *
 * There is deliberately no chair-side "move" control: provenance and consent
 * are preserved by making the author the actor.
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

  const publisherVenueIds = [
    ...new Set(
      roles
        .filter((role) => role.roleTitle === "EDITOR_IN_CHIEF")
        .map((role) => role.venue.id),
    ),
  ];

  const [transferManuscripts, journals, publishable] = await Promise.all([
    conferenceIds.length
      ? prisma.manuscript.findMany({
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
        })
      : Promise.resolve([]),
    prisma.venue.findMany({
      where: { type: "JOURNAL", isPublished: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    publisherVenueIds.length
      ? prisma.manuscript.findMany({
          where: {
            venueId: { in: publisherVenueIds },
            status: { in: ["ACCEPTED_JOURNAL", "ACCEPTED_PROCEDINGS"] },
          },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            title: true,
            status: true,
            author: { select: { name: true } },
            venue: { select: { name: true, type: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  const manuscriptIds = transferManuscripts.map((manuscript) => manuscript.id);
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

  const transferCandidates: TransferCandidate[] = transferManuscripts.map(
    (manuscript) => ({
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
    }),
  );

  const publishCandidates: PublishCandidate[] = publishable.map((manuscript) => ({
    id: manuscript.id,
    title: manuscript.title,
    authorName: manuscript.author.name,
    venueName: manuscript.venue.name,
    venueType: manuscript.venue.type,
    status: manuscript.status,
  }));

  if (roles.length === 0) {
    return (
      <main>
        <header className="mb-6">
          <h1 className="sb-heading text-2xl">Editorial</h1>
          <p className="sb-subtitle mt-2 text-sm">
            Assign reviewers, decide, publish, and invite accepted conference
            papers to a journal.
          </p>
        </header>
        <p className="sb-card text-sm text-slate-500 dark:text-slate-400">
          You do not hold an editorial seat. A platform administrator can grant
          one from the Administration page.
        </p>
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <header>
        <h1 className="sb-heading text-2xl">Editorial</h1>
        <p className="sb-subtitle mt-2 text-sm">
          Publish accepted manuscripts and invite conference authors to submit an
          extended version to a journal.
        </p>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          You hold:{" "}
          {roles
            .map(
              (role) =>
                `${EDITORIAL_ROLE_LABELS[role.roleTitle]} at ${role.venue.name}`,
            )
            .join(" · ")}
        </p>
      </header>

      {publisherVenueIds.length > 0 ? (
        <PublishManuscriptPanel candidates={publishCandidates} />
      ) : null}

      {conferenceIds.length > 0 ? (
        <TransferInvitePanel
          candidates={transferCandidates}
          journals={journals}
        />
      ) : publisherVenueIds.length === 0 ? (
        <p className="sb-card text-sm text-slate-500 dark:text-slate-400">
          You do not hold an Editor-in-Chief or Track Chair seat at a conference,
          so there is no accepted paper to invite to a journal.
        </p>
      ) : null}
    </main>
  );
}
