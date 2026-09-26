"use server";

import { cache } from "react";

import { Prisma, JournalOutcome } from "@prisma/client";
import prisma from "@/lib/db";
import { resolvePostDeletePermission } from "@/lib/deletion";
import { requireActiveUser, isAuthorizedOrAdmin, getCurrentUser } from "@/lib/auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import { readFormValue, assertRichTextWithinLimit } from "@/lib/form";
import { COMMENT_PAGE_SIZE, MAX_JOURNAL_REVIEW_FEEDBACK } from "@/lib/constants";
import { VISIBLE_PARENT_COMMENT_WHERE } from "@/lib/comment-visibility";

import type { JournalReviewWithAuthor } from "@/types/cards";

/**
 * A single journal review (detail page). Mirrors `getRecommendation`:
 * materialized counters + the viewer's filtered vote/bookmark/comment state —
 * no dynamic `_count`, no relation-array fan-out (RULE 2).
 */
export const getJournalReview = cache(
  async (reviewId: string, userId?: string) => {
    return prisma.journalReview.findUnique({
      where: { id: reviewId },
      select: {
        id: true,
        rating: true,
        feedback: true,
        outcome: true,
        turnaroundTimeDays: true,
        editorialQualityScore: true,
        peerReviewRigorScore: true,
        isAnonymous: true,
        authorId: true,
        journalId: true,
        createdAt: true,
        updatedAt: true,
        editedAt: true,
        totalVotes: true,
        totalBookmarks: true,
        isFrozen: true,
        hasActiveAppeal: true,
        totalComments: true,
        author: {
          select: {
            id: true,
            name: true,
            handle: true,
            avatarUrl: true,
            institutionVerifiedAt: true,
            followers: userId
              ? { where: { followerId: userId }, select: { followerId: true } }
              : false,
          },
        },
        journal: { select: { id: true, title: true } },
        votes: userId ? { where: { userId }, select: { voteType: true } } : false,
        bookmarks: userId ? { where: { userId }, select: { id: true } } : false,
        comments: {
          where: VISIBLE_PARENT_COMMENT_WHERE,
          orderBy: { createdAt: "desc" },
          take: COMMENT_PAGE_SIZE + 1,
          select: {
            isDeleted: true,
            isFrozen: true,
            hasActiveAppeal: true,
            deletedByType: true,
            id: true,
            content: true,
            createdAt: true,
            updatedAt: true,
            editedAt: true,
            parentId: true,
            authorId: true,
            totalVotes: true,
            totalReplies: true,
            author: {
              select: {
                id: true,
                name: true,
                handle: true,
                avatarUrl: true,
                institutionVerifiedAt: true,
              },
            },
            mentions: true,
            votes: userId
              ? { where: { userId }, select: { voteType: true } }
              : false,
          },
        },
      },
    });
  },
);

/**
 * Paginated slice of a journal's reviews (lazy-loaded carousel/list). Mirrors
 * `getSupervisorRecommendations`.
 *
 * Identity comes from the session, server-side — never from a client argument.
 * (This loader used to accept `userId` from the browser, so any caller could
 * read another user's vote / bookmark / follow state.)
 *
 * Deliberately NOT cached: this is a `take: 1..5` carousel scoped to one
 * `journalId`, so a cache key per journal would mint an entry per journal for
 * ~1KB of data — a memory leak with none of the benefit the top-level lists get.
 */
export async function getJournalReviews(
  journalId: string,
  skip: number = 0,
  take: number = 1,
) {
  const user = await getCurrentUser();
  const userId = user?.id;

  return prisma.journalReview.findMany({
    where: { journalId, isDeleted: false },
    skip,
    take,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
      rating: true,
      feedback: true,
      outcome: true,
      turnaroundTimeDays: true,
      editorialQualityScore: true,
      peerReviewRigorScore: true,
      isAnonymous: true,
      journalId: true,
      authorId: true,
      author: {
        select: {
          id: true,
          name: true,
          handle: true,
          avatarUrl: true,
          institutionVerifiedAt: true,
          followers: userId
            ? { where: { followerId: userId }, select: { followerId: true } }
            : false,
        },
      },
      journal: { select: { id: true, title: true } },
      totalVotes: true,
      totalBookmarks: true,
      totalComments: true,
      votes: userId ? { where: { userId }, select: { voteType: true } } : false,
      bookmarks: userId ? { where: { userId }, select: { id: true } } : false,
    },
  });
}

/**
 * Aggregate stats for the journal detail page: average rating, per-star
 * distribution, total count and the viewer's own review id. Mirrors
 * `getSupervisorRecommendationMeta`.
 */
export async function getJournalReviewMeta(journalId: string) {
  // Identity comes from the session, server-side — never from a client
  // argument. This used to accept `userId` and filter the author's
  // `followers` relation by it, so any caller could read another user's
  // follow relationships.
  const user = await getCurrentUser();
  const userId = user?.id;

  // NOTE: no `isAnonymous` filter here — mirrors
  // `getSupervisorRecommendationMeta`. Anonymous reviews still count toward
  // totals/distribution and toward the viewer's own-review detection; the
  // duplicate guard in `createJournalReview` uses the same unfiltered scope,
  // so filtering here would show "No reviews yet" while create reports
  // "You already have a review".
  const reviews = await prisma.journalReview.findMany({
    where: { journalId, isDeleted: false },
    select: { id: true, rating: true, authorId: true },
  });

  const total = reviews.length;
  const avgRating =
    total > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / total
      : 0;
  const ratingDistribution = [5, 4, 3, 2, 1].map((stars) => {
    const count = reviews.filter((r) => r.rating === stars).length;
    return {
      stars,
      count,
      percentage: total > 0 ? (count / total) * 100 : 0,
    };
  });

  return {
    totalCount: total,
    avgRating,
    ratingDistribution,
    hasUserReview: !!(userId && reviews.some((r) => r.authorId === userId)),
    userReviewId:
      reviews.find((r) => r.authorId === userId)?.id ?? null,
  };
}
// __END_PART_1__

// ============================================
// CREATE
// ============================================
export async function createJournalReview(
  formData: FormData,
  journalId: string,
) {
  const user = await requireActiveUser(
    "Log in to share a journal review and help other scholars!",
  );
  await enforceRateLimit({
    namespace: "journalReview:create",
    key: user.id,
    limit: 10,
    window: "10 m",
  });

  const rating = Number.parseInt(readFormValue(formData, "rating"), 10);
  const feedback = readFormValue(formData, "feedback");
  assertRichTextWithinLimit(feedback, MAX_JOURNAL_REVIEW_FEEDBACK, "Feedback");
  const outcome = readFormValue(formData, "outcome") as JournalOutcome;
  const turnaroundTimeDays = Number.parseInt(
    readFormValue(formData, "turnaroundTimeDays"),
    10,
  );
  const editorialQualityScore = Number.parseInt(
    readFormValue(formData, "editorialQualityScore"),
    10,
  );
  const peerReviewRigorScore = Number.parseInt(
    readFormValue(formData, "peerReviewRigorScore"),
    10,
  );
  const isAnonymous = formData.has("isAnonymous");

  // Prevent duplicate reviews (defense-in-depth alongside the partial unique
  // index). Soft-deleted reviews are excluded so a scholar can resubmit.
  const existing = await prisma.journalReview.findFirst({
    where: { journalId, authorId: user.id, isDeleted: false },
    select: { id: true },
  });

  if (existing) {
    return { success: false as const, error: "You already have a review for this journal." };
  }

  let review;
  try {
    review = await prisma.$transaction(async (tx) => {
      const newReview = await tx.journalReview.create({
        data: {
          rating,
          feedback,
          outcome,
          turnaroundTimeDays,
          editorialQualityScore,
          peerReviewRigorScore,
          isAnonymous,
          journalId,
          authorId: user.id,
        },
        // Include the relations the client-side caches expect so optimistic
        // list updates render correctly (owner detection, header, etc.)
        include: {
          author: {
            select: {
              id: true,
              name: true,
              handle: true,
              avatarUrl: true,
              institutionVerifiedAt: true,
              followers: {
                where: { followerId: user.id },
                select: { followerId: true },
              },
            },
          },
          journal: { select: { id: true, title: true } },
          votes: { where: { userId: user.id }, select: { voteType: true } },
          bookmarks: { where: { userId: user.id }, select: { id: true } },
        },
      });

      if (!isAnonymous) {
        await tx.userActivity.create({
          data: {
            userId: user.id,
            action: "PUBLISHED",
            moduleType: "JOURNAL_REVIEW",
            entityId: `${journalId}/${newReview.id}`,
            entityTitle: `${newReview.journal.title}|||${feedback.substring(0, 512)}`,
          },
        });
      }

      await tx.user.update({
        where: { id: user.id },
        data: {
          ...(isAnonymous ? {} : { journalReviewCount: { increment: 1 } }),
          reputation: { increment: 1 },
        },
      });

      // Materialized journal aggregates (Rule 2/3)
      await tx.journal.update({
        where: { id: journalId },
        data: {
          reviewCount: { increment: 1 },
          ratingSum: { increment: rating },
        },
      });

      return newReview;
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        success: false as const,
        error: "You have already submitted a review for this journal.",
      };
    }
    throw error;
  }

  return { success: true as const, data: review as JournalReviewWithAuthor };
}
// __END_PART_2__

// ============================================
// UPDATE
// ============================================
export async function updateJournalReview(
  formData: FormData,
  reviewId: string,
) {
  const user = await requireActiveUser("Log in to edit this review.");
  await enforceRateLimit({
    namespace: "journalReview:edit",
    key: user.id,
    limit: 20,
    window: "10 m",
  });

  const rating = Number.parseInt(readFormValue(formData, "rating"), 10);
  const feedback = readFormValue(formData, "feedback");
  assertRichTextWithinLimit(feedback, MAX_JOURNAL_REVIEW_FEEDBACK, "Feedback");
  const outcome = readFormValue(formData, "outcome") as JournalOutcome;
  const turnaroundTimeDays = Number.parseInt(
    readFormValue(formData, "turnaroundTimeDays"),
    10,
  );
  const editorialQualityScore = Number.parseInt(
    readFormValue(formData, "editorialQualityScore"),
    10,
  );
  const peerReviewRigorScore = Number.parseInt(
    readFormValue(formData, "peerReviewRigorScore"),
    10,
  );
  const isAnonymous = formData.has("isAnonymous");

  try {
    const review = await prisma.journalReview.findUnique({
      where: { id: reviewId },
      select: {
        authorId: true,
        journalId: true,
        isAnonymous: true,
        rating: true,
        outcome: true,
        feedback: true,
        turnaroundTimeDays: true,
        editorialQualityScore: true,
        peerReviewRigorScore: true,
      },
    });

    if (!review) {
      return { success: false as const, error: "Review not found." };
    }
    if (!(await isAuthorizedOrAdmin(review.authorId, user.id))) {
      return { success: false as const, error: "Not authorized to edit this review." };
    }

    const updatedReview = await prisma.$transaction(async (tx) => {
      const updated = await tx.journalReview.update({
        where: { id: reviewId },
        data: {
          rating,
          feedback,
          outcome,
          turnaroundTimeDays,
          editorialQualityScore,
          peerReviewRigorScore,
          isAnonymous,
          editedAt: new Date(),
        },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              handle: true,
              avatarUrl: true,
              institutionVerifiedAt: true,
            },
          },
          journal: { select: { id: true, title: true } },
        },
      });

      // Anonymity toggle: keep the profile content counter honest (Rule 3).
      if (!review.isAnonymous && isAnonymous) {
        await tx.user.update({
          where: { id: review.authorId },
          data: { journalReviewCount: { decrement: 1 } },
        });
        await tx.userActivity.deleteMany({
          where: {
            userId: review.authorId,
            action: "PUBLISHED",
            moduleType: "JOURNAL_REVIEW",
            entityId: `${review.journalId}/${reviewId}`,
          },
        });
      } else if (review.isAnonymous && !isAnonymous) {
        await tx.user.update({
          where: { id: review.authorId },
          data: { journalReviewCount: { increment: 1 } },
        });
        await tx.userActivity.create({
          data: {
            userId: review.authorId,
            action: "PUBLISHED",
            moduleType: "JOURNAL_REVIEW",
            entityId: `${review.journalId}/${reviewId}`,
            entityTitle: `${updated.journal.title}|||${feedback.substring(0, 512)}`,
          },
        });
      }

      // Materialized journal aggregates (Rule 2/3): a rating edit shifts the
      // running sum; an anonymity flip does not touch the journal aggregates.
      const ratingDelta = rating - review.rating;
      if (ratingDelta !== 0) {
        await tx.journal.update({
          where: { id: review.journalId },
          data: { ratingSum: { increment: ratingDelta } },
        });
      }

      return updated;
    });

    return { success: true as const, data: updatedReview as JournalReviewWithAuthor };
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes("authorized") || error.message.includes("not found"))
    ) {
      return { success: false as const, error: error.message };
    }
    throw error;
  }
}
// __END_PART_3__

// ============================================
// DELETE (soft) — mirrors deleteRecommendation
// ============================================
export async function deleteJournalReview(reviewId: string) {
  const user = await requireActiveUser("Log in to delete this review.");
  await enforceRateLimit({
    namespace: "journalReview:delete",
    key: user.id,
    limit: 20,
    window: "10 m",
  });

  const review = await prisma.journalReview.findUnique({
    where: { id: reviewId },
    select: {
      authorId: true,
      journalId: true,
      totalVotes: true,
      totalBookmarks: true,
      isAnonymous: true,
      rating: true,
    },
  });

  if (!review) {
    throw new Error("Review not found.");
  }
  const deletedByType = await resolvePostDeletePermission(
    user.id,
    review.authorId,
  );

  await prisma.$transaction(async (tx) => {
    await tx.journalReview.update({
      where: { id: reviewId },
      data: { isDeleted: true, deletedByType, deletedById: user.id },
    });

    // Materialized journal aggregates (Rule 2/3): the journal-level rating
    // average is unaffected by anonymity, but the author profile counter is.
    await tx.journal.update({
      where: { id: review.journalId },
      data: {
        reviewCount: { decrement: 1 },
        ratingSum: { decrement: review.rating },
      },
    });

    await tx.user.update({
      where: { id: review.authorId },
      data: {
        ...(review.isAnonymous ? {} : { journalReviewCount: { decrement: 1 } }),
        reputation: { decrement: 1 },
      },
    });

    if (review.totalVotes !== 0) {
      await tx.user.update({
        where: { id: review.authorId },
        data: { reputation: { decrement: review.totalVotes } },
      });
    }
  });

  return {
    success: true,
    data: {
      deletedId: reviewId,
      journalId: review.journalId,
    },
  };
}