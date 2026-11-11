"use server";

import { cache } from "react";

import prisma from "@/lib/db";
import { resolvePostDeletePermission } from "@/lib/deletion";
import { Prisma } from "@prisma/client";
import { getActiveUser, requireCurrentUser, isAuthorizedOrAdmin } from "@/lib/auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import { readFormValue, assertRichTextWithinLimit } from "@/lib/form";
import { COMMENT_PAGE_SIZE, MAX_RECOMMENDATION_FEEDBACK } from "@/lib/constants";
import { VISIBLE_PARENT_COMMENT_WHERE } from "@/lib/comment-visibility";
import { revalidateBookmarkersForDeletedContent, revalidateProfileContent } from "@/lib/tri-split/modules/profile-tab";
import { hideContentActivity } from "@/lib/activity";
import { notifyFollowersOfActivity, deleteAllNotificationsForContent, deleteAuthorNotificationsForContent } from "@/lib/notifications";

export const getRecommendation = cache(
  async (recommendationId: string, userId?: string) => {
    return prisma.recommendation.findUnique({
      where: { id: recommendationId, isDeleted: false },
      // RULE 2 (Zero-Compute): strict select + materialized counters.
      // No include trees, no dynamic _count aggregation.
      select: {
        id: true,
        rating: true,
        feedback: true,
        turnaroundTimeDays: true,
        responsivenessScore: true,
        guidanceScore: true,
        isAnonymous: true,
        authorId: true,
        createdAt: true,
        updatedAt: true,
        editedAt: true,
        totalVotes: true,
        totalBookmarks: true,
        isFrozen: true,
        hasActiveAppeal: true,
        isDeleted: true,
        deletedByType: true,
        totalComments: true,
        author: {
          select: {
            id: true,
            name: true,
            handle: true,
            avatarUrl: true, institutionVerifiedAt: true,
          },
        },
        supervisor: { select: { id: true, name: true } },
        // Filtered select resolves the viewer's vote in the same round-trip
        // instead of shipping every vote row into memory.
        votes: userId
          ? { where: { userId }, select: { voteType: true } }
          : false,
        bookmarks: userId ? { where: { userId }, select: { id: true } } : false,
        comments: {
          where: VISIBLE_PARENT_COMMENT_WHERE,
          // LAZY PAGINATION: matches @@index([recommendationId, createdAt(sort: Desc)])
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
                avatarUrl: true, institutionVerifiedAt: true,
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

export async function createRecommendation(
  formData: FormData,
  supervisorId: string,
) {
  const auth = await getActiveUser(
    "Log in to share your recommendation and help other scholars!",
  );
  if (auth.frozen) return { success: false, error: auth.message, message: auth.message };
  const user = auth.user;
  await enforceRateLimit({ namespace: "recommendation:create", key: user.id, limit: 10, window: "10 m" });

  // A frozen supervisor profile is read-only, exactly like frozen posts: the
  // banner promises that interactions are disabled, so recommendations must be
  // rejected here too (not only in the UI).
  const supervisor = await prisma.supervisor.findUnique({
    where: { id: supervisorId, isDeleted: false },
    select: { isFrozen: true, name: true },
  });
  if (!supervisor) {
    return { success: false, error: "Supervisor not found." };
  }
  if (supervisor.isFrozen) {
    return {
      success: false,
      error:
        "This supervisor is frozen by moderators and cannot receive recommendations.",
    };
  }

  const feedback = readFormValue(formData, "feedback");
  assertRichTextWithinLimit(feedback, MAX_RECOMMENDATION_FEEDBACK, "Feedback");
  const rating = Number.parseInt(readFormValue(formData, "rating"), 10);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { success: false, error: "Rating must be between 1 and 5." };
  }

  const turnaroundTimeDays = Number.parseInt(
    readFormValue(formData, "turnaroundTimeDays"),
    10,
  );
  const responsivenessScore = Number.parseInt(
    readFormValue(formData, "responsivenessScore"),
    10,
  );
  const guidanceScore = Number.parseInt(
    readFormValue(formData, "guidanceScore"),
    10,
  );
  const isAnonymous = formData.has("isAnonymous");

  // Prevent duplicate recommendations (e.g., if user navigates directly to this page
  // even after the UI hides the “recommend” button).
  // NOTE: soft-deleted recommendations are excluded so a scholar can write
  // a new one after deleting their previous recommendation.
  const existing = await prisma.recommendation.findFirst({
    where: {
      supervisorId,
      authorId: user.id,
      isDeleted: false,
    },
    select: { id: true },
  });

  if (existing) {
    return {
      success: false,
      error: "You already have a recommendation for this supervisor.",
    };
  }

  // Defense-in-depth: even with the app-level check above, two simultaneous
  // submissions (or the partial unique index) can raise P2002. Return a
  // friendly error instead of a raw Prisma crash.
  let recommendation;
  try {
    recommendation = await prisma.$transaction(async (tx) => {
      const newRecommendation = await tx.recommendation.create({
        data: {
          rating,
          feedback,
          turnaroundTimeDays,
          responsivenessScore,
          guidanceScore,
          isAnonymous,
          supervisorId,
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
              avatarUrl: true, institutionVerifiedAt: true,
              followers: {
                where: { followerId: user.id },
                select: { followerId: true },
              },
            },
          },
          supervisor: { select: { id: true, name: true } },
          votes: { where: { userId: user.id }, select: { voteType: true } }, bookmarks: { where: { userId: user.id }, select: { id: true } },
        },
      });

      if (!isAnonymous) {
        await tx.userActivity.create({
          data: {
            userId: user.id,
            action: "PUBLISHED",
            moduleType: "RECOMMENDATION",
            entityId: `${supervisorId}/${newRecommendation.id}`,
            entityTitle:
              `${supervisor.name}|||${feedback.substring(0, 512)}`,
          },
        });
      }

       await tx.user.update({
         where: { id: user.id },
         data: {
           ...(isAnonymous ? {} : { recommendationCount: { increment: 1 } }),
         },
       });

      // Materialized supervisor aggregates (Rule 2/3)
      await tx.supervisor.update({
        where: { id: supervisorId },
        data: {
          recommendationCount: { increment: 1 },
          ratingSum: { increment: rating },
        },
      });

      return newRecommendation;
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        success: false,
        error:
          "You have already submitted a recommendation for this supervisor.",
      };
    }
    throw error;
  }

  // Anonymous recommendations stay out of follower feeds, mirroring the
  // supervisor/journal contract.
  if (!isAnonymous) {
    await notifyFollowersOfActivity({
      actorId: user.id,
      type: "content-published",
      targetType: "Recommendation",
      targetId: `${supervisorId}/${recommendation.id}`,
      title: `${user.email?.split("@")[0] || "Someone"} added a new supervisor recommendation`,
      body: `${supervisor.name} — ${rating}/5`,
    });
  }

  revalidateProfileContent(user.id);
  return { success: true, data: recommendation };
}

export async function updateRecommendation(
  formData: FormData,
  recommendationId: string,
) {
  // Frozen owners may edit (to correct content before appealing).
  const user = await requireCurrentUser("Log in to edit this recommendation.");
  await enforceRateLimit({ namespace: "recommendation:edit", key: user.id, limit: 20, window: "10 m" });

  const feedback = readFormValue(formData, "feedback");
  assertRichTextWithinLimit(feedback, MAX_RECOMMENDATION_FEEDBACK, "Feedback");
  const rating = Number.parseInt(readFormValue(formData, "rating"), 10);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { success: false as const, error: "Rating must be between 1 and 5." };
  }

  const turnaroundTimeDays = Number.parseInt(
    readFormValue(formData, "turnaroundTimeDays"),
    10,
  );
  const responsivenessScore = Number.parseInt(
    readFormValue(formData, "responsivenessScore"),
    10,
  );
  const guidanceScore = Number.parseInt(
    readFormValue(formData, "guidanceScore"),
    10,
  );
  const isAnonymous = formData.has("isAnonymous");

  try {
    const recommendation = await prisma.recommendation.findUnique({
      where: { id: recommendationId },
      select: {
        authorId: true,
        supervisorId: true,
        isAnonymous: true,
        rating: true,
      },
    });

    if (!recommendation) {
      return { success: false as const, error: "Recommendation not found." };
    }
    if (!(await isAuthorizedOrAdmin(recommendation.authorId, user.id))) {
      return {
        success: false as const,
        error: "Not authorized to edit this recommendation.",
      };
    }

    const updatedRecommendation = await prisma.$transaction(async (tx) => {
      const updated = await tx.recommendation.update({
        where: { id: recommendationId },
        data: {
          rating,
          feedback,
          turnaroundTimeDays,
          responsivenessScore,
          guidanceScore,
          isAnonymous,
          editedAt: new Date(),
        },
        include: {
          // Include relations so client caches render owner/header correctly
          author: {
            select: { id: true, name: true, handle: true, avatarUrl: true, institutionVerifiedAt: true },
          },
          supervisor: { select: { id: true, name: true } },
        },
      });

      // Anonymity toggle: keep the materialized profile counter honest (Rule 3).
      if (!recommendation.isAnonymous && isAnonymous) {
        await tx.user.update({
          where: { id: recommendation.authorId },
          data: { recommendationCount: { decrement: 1 } },
        });
        await tx.userActivity.deleteMany({
          where: {
            userId: recommendation.authorId,
            action: "PUBLISHED",
            moduleType: "RECOMMENDATION",
            OR: [
              { entityId: recommendationId },
              { entityId: `${recommendation.supervisorId}/${recommendationId}` },
            ],
          },
        });
        // Identity toggle: remove the author's own notifications for this
        // recommendation so a non-anon → anon switch doesn't leak who published it.
        await deleteAuthorNotificationsForContent(
          tx,
          recommendation.authorId,
          [recommendationId, `${recommendation.supervisorId}/${recommendationId}`],
        );
      } else if (recommendation.isAnonymous && !isAnonymous) {
        await tx.user.update({
          where: { id: recommendation.authorId },
          data: { recommendationCount: { increment: 1 } },
        });
        await tx.userActivity.create({
          data: {
            userId: recommendation.authorId,
            action: "PUBLISHED",
            moduleType: "RECOMMENDATION",
            entityId: `${recommendation.supervisorId}/${recommendationId}`,
            entityTitle: `${updated.supervisor.name}|||${feedback.substring(0, 512)}`,
          },
        });
      }

      // Materialized supervisor aggregates (Rule 2/3): a rating edit shifts
      // the running sum. Anonymity only affects the author's profile surface,
      // not the supervisor's total recommendation aggregate.
      const ratingDelta = rating - recommendation.rating;
      await tx.supervisor.update({
        where: { id: recommendation.supervisorId },
        data: {
          ...(ratingDelta !== 0
            ? { ratingSum: { increment: ratingDelta } }
            : {}),
        },
      });

      return updated;
    });

    revalidateProfileContent(recommendation.authorId);
    return { success: true as const, data: updatedRecommendation };
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes("authorized") ||
        error.message.includes("not found"))
    ) {
      return { success: false as const, error: error.message };
    }
    throw error;
  }
}

export async function deleteRecommendation(recommendationId: string) {
  // Frozen owners may delete own content (read/edit/delete allowed, create blocked).
  const user = await requireCurrentUser("Log in to delete this recommendation.");
  await enforceRateLimit({ namespace: "recommendation:delete", key: user.id, limit: 20, window: "10 m" });

  const recommendation = await prisma.recommendation.findUnique({
    where: { id: recommendationId },
    select: {
      authorId: true,
      supervisorId: true,
      totalVotes: true,
      totalBookmarks: true,
      totalComments: true,
      isAnonymous: true,
      rating: true,
    },
  });

  if (!recommendation) {
    throw new Error("Recommendation not found.");
  }
  const deletedByType = await resolvePostDeletePermission(
    user.id,
    recommendation.authorId,
  );

  await prisma.$transaction(async (tx) => {
    await tx.recommendation.update({
      where: { id: recommendationId },
      data: { isDeleted: true, deletedByType, deletedById: user.id },
    });

     await tx.user.update({
       where: { id: recommendation.authorId },
       data: {
         ...(recommendation.isAnonymous ? {} : { recommendationCount: { decrement: 1 } }),
       },
     });

    // Materialized supervisor aggregates (Rule 2/3)
    await tx.supervisor.update({
      where: { id: recommendation.supervisorId },
      data: {
        recommendationCount: { decrement: 1 },
        ratingSum: { decrement: recommendation.rating },
      },
    });

    if (recommendation.totalVotes !== 0) {
      await tx.user.update({
        where: { id: recommendation.authorId },
        data: { reputation: { decrement: recommendation.totalVotes } },
      });
    }

    // Hide this content's activity so a deleted recommendation stops appearing in
    // anyone's activity feed at once (not after the cache TTL). COMMENTED rows
    // store the bare id while publish / vote rows store the nested route id,
    // so hide against both.
    const recommendationNested =
      recommendation.supervisorId
        ? `${recommendation.supervisorId}/${recommendationId}`
        : undefined;
    await hideContentActivity(
      tx,
      "RECOMMENDATION",
      recommendationId,
      ...(recommendationNested ? [recommendationNested] : [])
    )

    // Delete every notification pointing at this recommendation and its comments,
    // using both the bare id and the nested supervisorId/recommendationId composite.
    await deleteAllNotificationsForContent(tx, "RECOMMENDATION", recommendationId)
  });

  revalidateProfileContent(recommendation.authorId);

  // Purge every bookmarker's Bookmarks tab so a soft-deleted recommendation
  // stops inflating their bookmark count or showing a phantom "show more" arrow.
  await revalidateBookmarkersForDeletedContent("RECOMMENDATION", recommendationId);

  return {
    success: true,
    data: {
      deletedId: recommendationId,
      supervisorId: recommendation.supervisorId,
      isDeleted: true as const,
      deletedByType,
      totalComments: recommendation.totalComments,
      // Used by both delete UIs to decrement the right star bucket.
      rating: recommendation.rating,
    },
  };
}
