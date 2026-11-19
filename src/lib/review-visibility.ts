import type { Prisma } from "@prisma/client";

/**
 * Visibility predicate for parent-scoped reviews (supervisor recommendations
 * and journal reviews).
 *
 * These rows have no detail page of their own: they render inline on their
 * parent's page. An admin-deleted row therefore has to stay reachable by its
 * author, because the owner-only tombstone (and its appeal button) can only be
 * shown there. Author self-deletes stay invisible everywhere.
 *
 * `totalCount`/rating aggregates must keep using `{ isDeleted: false }`; this
 * predicate is only for the list rows themselves.
 */
export function parentReviewWhere(viewerId?: string) {
  if (!viewerId) {
    return { isDeleted: false } satisfies
      | Prisma.RecommendationWhereInput
      | Prisma.JournalReviewWhereInput;
  }

  return {
    OR: [
      { isDeleted: false },
      {
        isDeleted: true,
        deletedByType: "ADMIN",
        authorId: viewerId,
      },
    ],
  } satisfies
    | Prisma.RecommendationWhereInput
    | Prisma.JournalReviewWhereInput;
}
