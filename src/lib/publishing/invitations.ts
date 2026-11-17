import "server-only";

import type { Prisma } from "@prisma/client";

import prisma from "@/lib/db";

/**
 * Transfer invitations, read from the append-only manuscript event log.
 *
 * An invitation is not a table: `TRANSFER_INVITED` records who invited the
 * author and to which journal, and `TRANSFER_DECLINED` records the refusal.
 * Neither event is ever mutated, so the history survives. Whether an invitation
 * is still open is decided by the **latest** event for a
 * `(manuscriptId, targetVenueId)` pair — a decline therefore closes an
 * invitation without rewriting it.
 */

export const INVITATION_EVENT_TYPES = [
  "TRANSFER_INVITED",
  "TRANSFER_DECLINED",
] as const;

export type InvitationEventType = (typeof INVITATION_EVENT_TYPES)[number];

export type InvitationEventLike = {
  id: string;
  type: string;
  createdAt: Date;
  targetVenueId: string | null;
};

export function invitationKey(manuscriptId: string, targetVenueId: string): string {
  return `${manuscriptId}:${targetVenueId}`;
}

/**
 * Latest event wins. The query that feeds this orders by `createdAt` desc, but
 * the comparison is explicit so a caller cannot accidentally pass ascending
 * rows and resurrect a declined invitation. When two events share a
 * millisecond, `TRANSFER_DECLINED` wins: a closed invitation must not reopen on
 * a clock tie.
 */
export function latestInvitationEvent<T extends InvitationEventLike>(
  events: readonly T[],
): T | null {
  let latest: T | null = null;

  for (const event of events) {
    if (!latest) {
      latest = event;
      continue;
    }
    const delta = event.createdAt.getTime() - latest.createdAt.getTime();
    if (delta > 0 || (delta === 0 && event.type === "TRANSFER_DECLINED")) {
      latest = event;
    }
  }

  return latest;
}

/** Latest invitation event per target venue, for one manuscript. */
export function latestInvitationByTarget<T extends InvitationEventLike>(
  events: readonly T[],
): Map<string, T> {
  const grouped = new Map<string, T[]>();

  for (const event of events) {
    if (!event.targetVenueId) continue;
    const list = grouped.get(event.targetVenueId) ?? [];
    list.push(event);
    grouped.set(event.targetVenueId, list);
  }

  const latest = new Map<string, T>();
  for (const [targetVenueId, list] of grouped) {
    const winner = latestInvitationEvent(list);
    if (winner) latest.set(targetVenueId, winner);
  }

  return latest;
}

export type AuthorInvitationState = "OPEN" | "DECLINED" | "SUBMITTED";

export type AuthorInvitation = {
  eventId: string;
  manuscriptId: string;
  manuscriptTitle: string;
  sourceVenueName: string;
  targetVenueId: string;
  targetVenueName: string;
  invitedByName: string | null;
  invitedOn: Date;
  state: AuthorInvitationState;
};

/**
 * Every transfer invitation for one author, with the state the author's
 * workspace should render. `SUBMITTED` is derived from the existence of a live
 * clone, so the list cannot show "pending" after the author has already acted.
 */
export async function listAuthorInvitations(
  userId: string,
): Promise<AuthorInvitation[]> {
  const [events, clones] = await Promise.all([
    prisma.manuscriptEvent.findMany({
      where: {
        type: { in: [...INVITATION_EVENT_TYPES] },
        targetVenueId: { not: null },
        manuscript: { authorId: userId },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        type: true,
        createdAt: true,
        targetVenueId: true,
        actor: { select: { name: true } },
        manuscript: {
          select: {
            id: true,
            title: true,
            venue: { select: { name: true } },
          },
        },
        targetVenue: { select: { id: true, name: true } },
      },
    }),
    prisma.manuscript.findMany({
      where: {
        authorId: userId,
        originalManuscriptId: { not: null },
        status: { not: "WITHDRAWN" },
      },
      select: { originalManuscriptId: true, venueId: true },
    }),
  ]);

  const submitted = new Set(
    clones
      .filter((clone) => clone.originalManuscriptId)
      .map((clone) => invitationKey(clone.originalManuscriptId!, clone.venueId)),
  );

  const grouped = new Map<string, (typeof events)[number][]>();
  for (const event of events) {
    if (!event.targetVenueId || !event.targetVenue) continue;
    const key = invitationKey(event.manuscript.id, event.targetVenueId);
    const list = grouped.get(key) ?? [];
    list.push(event);
    grouped.set(key, list);
  }

  const latestByPair = new Map<string, (typeof events)[number]>();
  for (const [key, list] of grouped) {
    const winner = latestInvitationEvent(list);
    if (winner) latestByPair.set(key, winner);
  }

  return [...latestByPair.values()].map((event) => {
    const targetVenueId = event.targetVenueId!;
    const key = invitationKey(event.manuscript.id, targetVenueId);
    const state: AuthorInvitationState = submitted.has(key)
      ? "SUBMITTED"
      : event.type === "TRANSFER_DECLINED"
        ? "DECLINED"
        : "OPEN";

    return {
      eventId: event.id,
      manuscriptId: event.manuscript.id,
      manuscriptTitle: event.manuscript.title,
      sourceVenueName: event.manuscript.venue.name,
      targetVenueId,
      targetVenueName: event.targetVenue!.name,
      invitedByName: event.actor?.name ?? null,
      invitedOn: event.createdAt,
      state,
    };
  });
}

export type OpenTransferInvitation = {
  eventId: string;
  invitedById: string | null;
  manuscript: {
    id: string;
    title: string;
    abstract: string | null;
    keywords: string | null;
    coAuthors: Prisma.JsonValue | null;
    venue: { id: string; name: string };
  };
  targetVenue: { id: string; name: string };
};

/**
 * Resolves an invitation event the author may still act on.
 *
 * Every refusal returns `null` — the caller only needs "not usable" — but each
 * check pins a real path:
 *   - the event belongs to this author (a leaked id is not a capability);
 *   - the source is still an accepted conference paper;
 *   - the target is a published journal (an invitation to a draft venue leaks
 *     an unpublished title);
 *   - the invitation is the latest event for its pair (a decline closes it);
 *   - no live clone already exists (a double submit must not create two rows).
 */
export async function findOpenInvitationForAuthor(params: {
  invitationEventId: string;
  authorId: string;
}): Promise<OpenTransferInvitation | null> {
  const event = await prisma.manuscriptEvent.findUnique({
    where: { id: params.invitationEventId },
    select: {
      id: true,
      type: true,
      createdAt: true,
      actorId: true,
      targetVenueId: true,
      manuscript: {
        select: {
          id: true,
          title: true,
          abstract: true,
          keywords: true,
          coAuthors: true,
          status: true,
          authorId: true,
          venue: { select: { id: true, name: true, type: true } },
        },
      },
      targetVenue: { select: { id: true, name: true, type: true, isPublished: true } },
    },
  });

  if (!event || event.type !== "TRANSFER_INVITED") return null;
  if (event.manuscript.authorId !== params.authorId) return null;
  // The invitation is created only for `ACCEPTED_PROCEDINGS`, but the
  // proceedings volume may be published before the author acts. Losing the
  // invitation at that point would strand a legitimate extended version,
  // because the editor cannot issue a new one for a terminal status.
  if (
    event.manuscript.status !== "ACCEPTED_PROCEDINGS" &&
    event.manuscript.status !== "PUBLISHED"
  ) {
    return null;
  }
  if (event.manuscript.venue.type !== "CONFERENCE") return null;

  if (
    !event.targetVenueId ||
    !event.targetVenue ||
    event.targetVenue.type !== "JOURNAL" ||
    !event.targetVenue.isPublished
  ) {
    return null;
  }

  const [latest, existingClone] = await Promise.all([
    prisma.manuscriptEvent.findFirst({
      where: {
        manuscriptId: event.manuscript.id,
        targetVenueId: event.targetVenueId,
        type: { in: [...INVITATION_EVENT_TYPES] },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    }),
    prisma.manuscript.findFirst({
      where: {
        originalManuscriptId: event.manuscript.id,
        venueId: event.targetVenueId,
        status: { not: "WITHDRAWN" },
      },
      select: { id: true },
    }),
  ]);

  if (latest?.id !== event.id) return null;
  if (existingClone) return null;

  return {
    eventId: event.id,
    invitedById: event.actorId,
    manuscript: {
      id: event.manuscript.id,
      title: event.manuscript.title,
      abstract: event.manuscript.abstract,
      keywords: event.manuscript.keywords,
      coAuthors: event.manuscript.coAuthors,
      venue: {
        id: event.manuscript.venue.id,
        name: event.manuscript.venue.name,
      },
    },
    targetVenue: {
      id: event.targetVenue.id,
      name: event.targetVenue.name,
    },
  };
}
