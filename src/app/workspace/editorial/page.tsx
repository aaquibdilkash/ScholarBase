import { redirect } from "next/navigation";
import Link from "next/link";
import type { EditorialRoleTitle } from "@prisma/client";

import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/db";
import { formatDate } from "@/utils/date";
import { EDITORIAL_ROLE_LABELS } from "@/lib/publishing/labels";
import {
  INVITATION_EVENT_TYPES,
  latestInvitationByTarget,
} from "@/lib/publishing/invitations";
import { ManuscriptStatusBadge } from "@/components/workspace/ManuscriptStatusBadge";
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

  // A reviewer may hold no editorial seat at all. Their queue lives here so a
  // review request is reachable without going back through the notification.
  const reviewQueue = await prisma.reviewTask.findMany({
    where: {
      reviewerId: user.id,
      isCompleted: false,
      manuscript: { status: { in: ["UNDER_REVIEW", "REVISION_REQUIRED"] } },
    },
    orderBy: { assignedAt: "asc" },
    select: {
      id: true,
      assignedAt: true,
      manuscript: {
        select: {
          id: true,
          title: true,
          status: true,
          venue: { select: { name: true } },
          author: { select: { name: true, email: true } },
        },
      },
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

  const deskVenueIds = [...new Set(roles.map((role) => role.venue.id))];

  const [transferManuscripts, journals, publishable, inbox, recentPublished] =
    await Promise.all([
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
      // The desk inbox: papers at this desk that still need someone to act.
      // A paper in review is not finished business, so it stays here until it
      // is decided — otherwise it disappears the moment a reviewer is assigned.
      deskVenueIds.length
        ? prisma.manuscript.findMany({
            where: {
              venueId: { in: deskVenueIds },
              status: { in: ["SUBMITTED", "UNDER_REVIEW", "REVISION_REQUIRED"] },
            },
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              title: true,
              status: true,
              createdAt: true,
              author: { select: { name: true, email: true } },
              venue: { select: { name: true } },
            },
          })
        : Promise.resolve([]),
      // Publication is where the DOI panel lives, so the desk needs a way back
      // into a paper after it leaves the accepted queue.
      publisherVenueIds.length
        ? prisma.manuscript.findMany({
            where: {
              venueId: { in: publisherVenueIds },
              status: "PUBLISHED",
            },
            orderBy: [
              { publishedAt: { sort: "desc", nulls: "last" } },
              { createdAt: "desc" },
            ],
            take: 12,
            select: {
              id: true,
              title: true,
              volume: true,
              issue: true,
              publishedAt: true,
              doi: true,
              venue: { select: { name: true } },
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

  if (roles.length === 0 && reviewQueue.length === 0) {
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
          You do not hold an editorial seat and have no review assigned. A
          platform administrator can grant a seat from the Administration page.
        </p>
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <header>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="sb-heading text-2xl">Editorial</h1>
            <p className="sb-subtitle mt-2 text-sm">
              Review, decide, publish, and invite conference authors to submit an
              extended version to a journal.
            </p>
          </div>
          {roles.length > 0 ? (
            <Link className="sb-button-soft" href="/workspace/editorial/board">
              Open decision board
            </Link>
          ) : null}
        </div>
        {roles.length > 0 ? (
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            You hold:{" "}
            {roles
              .map(
                (role) =>
                  `${EDITORIAL_ROLE_LABELS[role.roleTitle]} at ${role.venue.name}`,
              )
              .join(" · ")}
          </p>
        ) : null}
        {roles.length === 0 && reviewQueue.length > 0 ? (
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            You have no editorial seat. The queue below is the work assigned to
            you as a reviewer.
          </p>
        ) : null}
      </header>

      {reviewQueue.length > 0 ? (
        <section aria-labelledby="review-queue-heading">
          <h2 id="review-queue-heading" className="sb-heading text-lg">
            Reviews requested
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Papers waiting for your report. Reports are private; the author never
            sees your name.
          </p>
          <ul className="mt-3 space-y-3">
            {reviewQueue.map((task) => (
              <li key={task.id}>
                <Link
                  href={`/workspace/editorial/manuscripts/${task.manuscript.id}`}
                  className="sb-card flex flex-wrap items-start justify-between gap-3 transition hover:border-slate-400 dark:hover:border-slate-600"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-950 dark:text-slate-50">
                      {task.manuscript.title}
                    </p>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                      {task.manuscript.author.name ??
                        task.manuscript.author.email}
                      {` · ${task.manuscript.venue.name}`}
                      {` · invited ${formatDate(task.assignedAt)}`}
                    </p>
                  </div>
                  <ManuscriptStatusBadge status={task.manuscript.status} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {inbox.length > 0 ? (
        <section aria-labelledby="inbox-heading">
          <h2 id="inbox-heading" className="sb-heading text-lg">
            At your desk
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Submitted, under review, or awaiting a revision — open one to assign
            reviewers and record the decision.
          </p>
          <ul className="mt-3 space-y-3">
            {inbox.map((manuscript) => (
              <li key={manuscript.id}>
                <Link
                  href={`/workspace/editorial/manuscripts/${manuscript.id}`}
                  className="sb-card flex flex-wrap items-start justify-between gap-3 transition hover:border-slate-400 dark:hover:border-slate-600"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-950 dark:text-slate-50">
                      {manuscript.title}
                    </p>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                      {manuscript.author.name ?? manuscript.author.email}
                      {` · ${manuscript.venue.name}`}
                      {` · ${formatDate(manuscript.createdAt)}`}
                    </p>
                  </div>
                  <ManuscriptStatusBadge status={manuscript.status} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {publisherVenueIds.length > 0 ? (
        <PublishManuscriptPanel candidates={publishCandidates} />
      ) : null}

      {publisherVenueIds.length > 0 && recentPublished.length > 0 ? (
        <section className="sb-card">
          <h2 className="text-lg font-semibold tracking-tight text-slate-950 dark:text-slate-50">
            Recently published
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Open a paper to register its DOI. Registration happens after
            publication so an issue never waits on Zenodo.
          </p>
          <ul className="mt-3 divide-y divide-[var(--card-border)]">
            {recentPublished.map((manuscript) => (
              <li
                className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
                key={manuscript.id}
              >
                <div className="min-w-0">
                  <Link
                    className="text-sm font-medium text-slate-900 underline-offset-2 hover:underline dark:text-slate-100"
                    href={`/workspace/editorial/manuscripts/${manuscript.id}`}
                  >
                    {manuscript.title}
                  </Link>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {manuscript.venue.name}
                    {manuscript.volume
                      ? ` ${manuscript.volume}${manuscript.issue ? `(${manuscript.issue})` : ""}`
                      : ""}
                    {manuscript.publishedAt
                      ? ` · ${formatDate(manuscript.publishedAt)}`
                      : ""}
                  </p>
                </div>
                {manuscript.doi ? (
                  <a
                    className="text-xs font-semibold text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-300"
                    href={`https://doi.org/${manuscript.doi}`}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {manuscript.doi}
                  </a>
                ) : (
                  <Link
                    className="text-xs font-semibold text-blue-700 underline-offset-2 hover:underline dark:text-blue-300"
                    href={`/workspace/editorial/manuscripts/${manuscript.id}`}
                  >
                    Mint DOI →
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {conferenceIds.length > 0 ? (
        <TransferInvitePanel
          candidates={transferCandidates}
          journals={journals}
        />
      ) : publisherVenueIds.length === 0 && roles.length > 0 ? (
        <p className="sb-card text-sm text-slate-500 dark:text-slate-400">
          You do not hold an Editor-in-Chief or Track Chair seat at a conference,
          so there is no accepted paper to invite to a journal.
        </p>
      ) : null}
    </main>
  );
}
