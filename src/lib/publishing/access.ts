import prisma from "@/lib/db";
import { isUserAdmin } from "@/lib/auth";
import type { EditorialRoleTitle } from "@prisma/client";

/**
 * Who may see one manuscript and what they may do with it.
 *
 * Shared by the review workspace page and the private file route so the page
 * and the PDF bytes cannot disagree about who is allowed in. Platform admin is
 * `User.isAdmin`; a venue seat is an `EditorialRole` row.
 */
export type ManuscriptPermissions = {
  isEditor: boolean;
  isReviewer: boolean;
  isAuthor: boolean;
  isAdmin: boolean;
  roles: readonly EditorialRoleTitle[];
  /** The viewer's open review task for the current round, if any. */
  reviewTaskId: string | null;
  reviewCompleted: boolean;
};

export async function getManuscriptPermissions(
  userId: string,
  manuscript: {
    id: string;
    venueId: string;
    authorId: string;
    round: number;
  },
): Promise<ManuscriptPermissions> {
  const [isAdmin, roles, task] = await Promise.all([
    isUserAdmin(userId),
    prisma.editorialRole.findMany({
      where: { userId, venueId: manuscript.venueId },
      select: { roleTitle: true },
    }),
    prisma.reviewTask.findUnique({
      where: {
        manuscriptId_reviewerId_round: {
          manuscriptId: manuscript.id,
          reviewerId: userId,
          round: manuscript.round,
        },
      },
      select: { id: true, isCompleted: true },
    }),
  ]);

  return {
    isEditor: isAdmin || roles.length > 0,
    isReviewer: Boolean(task),
    isAuthor: manuscript.authorId === userId,
    isAdmin,
    roles: roles.map((role) => role.roleTitle),
    reviewTaskId: task?.id ?? null,
    reviewCompleted: task?.isCompleted ?? false,
  };
}

/** Anyone who may read the private PDF: the author, a reviewer, or the desk. */
export function canReadManuscriptFile(
  permissions: ManuscriptPermissions,
): boolean {
  return permissions.isAuthor || permissions.isReviewer || permissions.isEditor;
}
