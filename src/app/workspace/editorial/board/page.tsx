import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import type { EditorialRoleTitle } from "@prisma/client";

import { getCurrentUser, isUserAdmin } from "@/lib/auth";
import prisma from "@/lib/db";
import { buildNoindexMetadata } from "@/lib/seo";
import { BOARD_STATUSES } from "@/lib/publishing/board";
import { EDITORIAL_ROLE_LABELS } from "@/lib/publishing/labels";
import {
  DecisionBoard,
  type BoardVenueGroup,
} from "@/components/workspace/DecisionBoard";

export const metadata: Metadata = buildNoindexMetadata(
  "Decision board - ScholarBase",
);

/**
 * The desk at a glance.
 *
 * A venue-scoped board, not a global queue: a stage means the same thing only
 * inside one venue's workflow, and an editor of two venues should not have a
 * revision in one serial sitting next to a submission in another.
 *
 * The board reads `BOARD_STATUSES` and every write goes through
 * `decideManuscriptAction`; it has no mutation of its own.
 */
export default async function DecisionBoardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const roles = await prisma.editorialRole.findMany({
    where: { userId: user.id },
    select: {
      roleTitle: true,
      venue: { select: { id: true, name: true, type: true } },
    },
  });

  if (roles.length === 0) {
    return (
      <main>
        <Link
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
          href="/workspace/editorial"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Editorial desk
        </Link>
        <header className="mt-4">
          <h1 className="sb-heading text-2xl">Decision board</h1>
          <p className="sb-subtitle mt-2 text-sm">
            Every paper at a venue where you hold an editorial seat, one column
            per stage.
          </p>
        </header>
        <p className="sb-card mt-6 text-sm text-slate-500 dark:text-slate-400">
          You do not hold an editorial seat. A platform administrator can grant
          one from the Administration page, and the board covers only venues
          where you hold a seat.
        </p>
      </main>
    );
  }

  const isAdmin = await isUserAdmin(user.id);
  const venueIds = [...new Set(roles.map((role) => role.venue.id))];

  const manuscripts = await prisma.manuscript.findMany({
    where: {
      venueId: { in: venueIds },
      status: { in: [...BOARD_STATUSES] },
    },
    orderBy: [{ updatedAt: "desc" }],
    select: {
      id: true,
      title: true,
      status: true,
      round: true,
      updatedAt: true,
      doi: true,
      venueId: true,
      author: { select: { name: true, email: true } },
      reviews: { select: { isCompleted: true } },
    },
  });

  const venues = new Map<
    string,
    { name: string; type: "JOURNAL" | "CONFERENCE" }
  >();
  const rolesByVenue = new Map<string, EditorialRoleTitle[]>();

  for (const role of roles) {
    venues.set(role.venue.id, {
      name: role.venue.name,
      type: role.venue.type,
    });
    const held = rolesByVenue.get(role.venue.id) ?? [];
    held.push(role.roleTitle);
    rolesByVenue.set(role.venue.id, held);
  }

  const cardsByVenue = new Map<string, typeof manuscripts>();
  for (const manuscript of manuscripts) {
    const held = cardsByVenue.get(manuscript.venueId) ?? [];
    held.push(manuscript);
    cardsByVenue.set(manuscript.venueId, held);
  }

  const groups: BoardVenueGroup[] = [...venues.entries()]
    .sort(([, a], [, b]) => a.name.localeCompare(b.name))
    .map(([venueId, venue]) => ({
      venueId,
      venueName: venue.name,
      venueType: venue.type,
      roles: rolesByVenue.get(venueId) ?? [],
      cards: (cardsByVenue.get(venueId) ?? []).map((manuscript) => ({
        id: manuscript.id,
        title: manuscript.title,
        status: manuscript.status,
        round: manuscript.round,
        updatedAt: manuscript.updatedAt,
        doi: manuscript.doi,
        authorName: manuscript.author.name ?? manuscript.author.email,
        reviewTotal: manuscript.reviews.length,
        reviewCompleted: manuscript.reviews.filter((review) => review.isCompleted)
          .length,
      })),
    }));

  return (
    <main>
      <Link
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
        href="/workspace/editorial"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        Editorial desk
      </Link>

      <header className="mb-6 mt-4">
        <h1 className="sb-heading text-2xl">Decision board</h1>
        <p className="sb-subtitle mt-2 text-sm">
          Every paper at a venue where you hold an editorial seat. Move a card
          one safe step, or open it for the review reports and the decision
          letter.
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

      <DecisionBoard isAdmin={isAdmin} venues={groups} />
    </main>
  );
}
