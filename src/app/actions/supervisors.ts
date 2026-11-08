"use server";

import type { SupervisorWithAuthor } from "@/types/cards";

import {
  loadContentPage,
  revalidateContent,
} from "@/lib/tri-split/modules/registry";
import { revalidateBookmarkersForDeletedContent } from "@/lib/tri-split/modules/profile-tab";
import { hideContentActivity } from "@/lib/activity";

import { cache } from "react";

import prisma from "@/lib/db";
import { resolvePostDeletePermission } from "@/lib/deletion";
import { getActiveUser, requireCurrentUser, isAuthorizedOrAdmin, getCurrentUser } from "@/lib/auth";
import { notifyFollowersOfActivity } from "@/lib/notifications";
import { enforceRateLimit } from "@/lib/rate-limit";
import { readFormValue, assertRichTextWithinLimit } from "@/lib/form";
import { COMMENT_PAGE_SIZE, MAX_SUPERVISOR_ABOUT } from "@/lib/constants";
import { VISIBLE_PARENT_COMMENT_WHERE } from "@/lib/comment-visibility";

/**
 * Loads one page of supervisor rows for the
 * *current* viewer.
 *
 * Identity comes from the session, server-side — never from a client argument.
 * (This loader used to accept `userId` from the browser, so any caller could
 * read another user's vote / bookmark / follow state.)
 *
 * The cached viewer-agnostic batch plus the single-statement live overlay live
 * in `@/lib/tri-split/modules/registry`.
 */
export async function getSupervisors(
  q?: string,
  limit = 10,
  cursor?: string,
) {
  return loadContentPage("SUPERVISOR", { query: q, pageSize: limit, cursor }) as Promise<
  SupervisorWithAuthor[]
>;
}

export const getSupervisor = cache(async (id: string, userId?: string) => {
  return prisma.supervisor.findUnique({
    where: { id, isDeleted: false },
    select: {
      id: true,
      name: true,
      university: true,
      department: true,
      about: true,
      authorId: true,
      createdAt: true,
      updatedAt: true,
      author: {
        select: {
          id: true,
          name: true,
          handle: true,
          avatarUrl: true, institutionVerifiedAt: true,
          followers: userId
            ? { where: { followerId: userId }, select: { followerId: true } }
            : false,
        },
      },
      totalVotes: true,
      totalBookmarks: true,
      isFrozen: true,
      hasActiveAppeal: true,
      isAnonymous: true,
      isDeleted: true,
      deletedByType: true,
      totalComments: true,
      recommendationCount: true,
      votes: userId ? { where: { userId }, select: { voteType: true } } : false,
      bookmarks: userId ? { where: { userId }, select: { id: true } } : false,
      recommendations: {
        where: { isDeleted: false },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          createdAt: true,
          updatedAt: true,
          rating: true,
          feedback: true,
          turnaroundTimeDays: true,
          responsivenessScore: true,
          guidanceScore: true,
          isAnonymous: true,
          supervisorId: true,
          authorId: true,
          author: {
            select: {
              id: true,
              name: true,
              handle: true,
              avatarUrl: true, institutionVerifiedAt: true,
              followers: userId
                ? {
                    where: { followerId: userId },
                    select: { followerId: true },
                  }
                : false,
            },
          },
          totalVotes: true,
          totalBookmarks: true,
          isFrozen: true,
          hasActiveAppeal: true,
          totalComments: true,
          isDeleted: true,
          deletedByType: true,
          votes: userId
            ? { where: { userId }, select: { voteType: true } }
            : false,
          bookmarks: userId ? { where: { userId }, select: { id: true } } : false,
        },
      },
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
          author: {
            select: { id: true, name: true, handle: true, avatarUrl: true, institutionVerifiedAt: true },
          },
          totalVotes: true,
          totalReplies: true,
          votes: userId
            ? { where: { userId }, select: { voteType: true } }
            : false,
          mentions: true,
        },
      },
    },
  });
});

/**
 * Fetch the next batch of recommendations for a supervisor (lazy-loaded carousel).
 *
 * Identity comes from the session, server-side — never from a client argument.
 * (This loader used to accept `userId` from the browser, so any caller could
 * read another user's vote / bookmark / follow state.)
 *
 * Deliberately NOT cached: a `take: 1` carousel scoped to one `supervisorId`
 * would mint a cache entry per supervisor for ~1KB of data.
 */
export async function getSupervisorRecommendations(
  supervisorId: string,
  skip: number = 0,
  take: number = 1,
) {
  const user = await getCurrentUser();
  const userId = user?.id;

  return prisma.recommendation.findMany({
    where: { supervisorId, isDeleted: false },
    skip,
    take,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
      rating: true,
      feedback: true,
      turnaroundTimeDays: true,
      responsivenessScore: true,
      guidanceScore: true,
      isAnonymous: true,
      supervisorId: true,
      supervisor: { select: { id: true, name: true } },
      authorId: true,
      author: {
        select: {
          id: true,
          name: true,
          handle: true,
          avatarUrl: true, institutionVerifiedAt: true,
          followers: userId
            ? { where: { followerId: userId }, select: { followerId: true } }
            : false,
        },
      },
      totalVotes: true,
      totalBookmarks: true,
      totalComments: true,
      isDeleted: true,
      deletedByType: true,
      votes: userId ? { where: { userId }, select: { voteType: true } } : false,
      bookmarks: userId ? { where: { userId }, select: { id: true } } : false,
    },
  });
}

/**
 * Aggregate stats for the supervisor detail page (rating + distribution + ownership).
 */
export async function getSupervisorRecommendationMeta(
  supervisorId: string,
) {
  // Identity comes from the session, server-side — never from a client argument.
  const user = await getCurrentUser();
  const userId = user?.id;

  const recommendations = await prisma.recommendation.findMany({
    // Live rows plus engaged tombstones. The tombstone is reachable in the
    // carousel, but it must not count toward the rating or the heading.
    where: { supervisorId, isDeleted: false },
    select: { id: true, rating: true, authorId: true, isDeleted: true },
  });

  const live = recommendations.filter((r) => !r.isDeleted);
  const total = live.length;
  const avgRating =
    total > 0 ? live.reduce((sum, r) => sum + r.rating, 0) / total : 0;
  const ratingDistribution = [5, 4, 3, 2, 1].map((stars) => {
    const count = live.filter((r) => r.rating === stars).length;
    return {
      stars,
      count,
      percentage: total > 0 ? (count / total) * 100 : 0,
    };
  });

  return {
    totalCount: total,
    /** Live + engaged tombstones — what the carousel can page through. */
    visibleCount: recommendations.length,
    avgRating,
    ratingDistribution,
    hasUserRecommendation: !!(
      userId && live.some((r) => r.authorId === userId)
    ),
    // Id of the caller's own active recommendation (for "Edit your recommendation" UX)
    userRecommendationId: live.find((r) => r.authorId === userId)?.id ?? null,
  };
}

export async function createSupervisor(formData: FormData) {
  const auth = await getActiveUser("Log in to add a supervisor entry.");
  if (auth.frozen) return { success: false as const, error: auth.message, message: auth.message };
  const user = auth.user;
  await enforceRateLimit({ namespace: "supervisor:create", key: user.id, limit: 10, window: "10 m" });

  const name = readFormValue(formData, "name");
  const university = readFormValue(formData, "university");
  const department = readFormValue(formData, "department");
  const about = readFormValue(formData, "about");
  assertRichTextWithinLimit(about, MAX_SUPERVISOR_ABOUT, "About");
  const isAnonymous = formData.has("isAnonymous");

  const supervisor = await prisma.$transaction(async (tx) => {
    const newSupervisor = await tx.supervisor.create({
      data: {
        name,
        university,
        department,
        about,
        isAnonymous,
        authorId: user.id,
      },
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
        votes: { where: { userId: user.id }, select: { voteType: true } }, bookmarks: { where: { userId: user.id }, select: { id: true } },
      },
    });

    // Anonymous content stays out of the author's profile count and activity
    // log, mirroring `createRecommendation` / `createJournalReview`.
    if (!isAnonymous) {
      await tx.user.update({
        where: { id: user.id },
        data: { supervisorCount: { increment: 1 } },
      });

      await tx.userActivity.create({
        data: {
          userId: user.id,
          action: "PUBLISHED",
          moduleType: "SUPERVISOR",
          entityId: newSupervisor.id,
          entityTitle: newSupervisor.name,
        },
      });
    }

    return newSupervisor;
  });

  // Anonymous content stays out of follower feeds, mirroring the journal and
  // recommendation contract.
  if (!isAnonymous) {
    await notifyFollowersOfActivity({
      actorId: user.id,
      type: "content-published",
      targetType: "Supervisor",
      targetId: supervisor.id,
      title: `${user.email?.split("@")[0] || "Someone"} added a new supervisor`,
      body: `${name}${university ? ` at ${university}` : ""}${department ? ` (${department})` : ""}`,
    });
  }

  // Purge the cached supervisor pages: publish must be visible at once, not after the TTL.
  revalidateContent("SUPERVISOR", user.id);

  return { success: true as const, data: supervisor };
}

export async function updateSupervisor(
  formData: FormData,
  supervisorId: string,
) {
  // Frozen owners may edit (to correct content before appealing).
  const user = await requireCurrentUser("Log in to edit this supervisor.");
  await enforceRateLimit({ namespace: "supervisor:edit", key: user.id, limit: 20, window: "10 m" });

  const name = readFormValue(formData, "name");
  const university = readFormValue(formData, "university");
  const department = readFormValue(formData, "department");
  const about = readFormValue(formData, "about");
  assertRichTextWithinLimit(about, MAX_SUPERVISOR_ABOUT, "About");
  const isAnonymous = formData.has("isAnonymous");

  const supervisor = await prisma.supervisor.findUnique({
    where: { id: supervisorId },
    select: { authorId: true, isAnonymous: true },
  });

  if (!supervisor) {
    throw new Error("Supervisor not found.");
  }
  if (!(await isAuthorizedOrAdmin(supervisor.authorId, user.id))) {
    throw new Error("Not authorized to edit this supervisor.");
  }

  const updatedSupervisor = await prisma.$transaction(async (tx) => {
    const updated = await tx.supervisor.update({
      where: { id: supervisorId },
      data: { name, university, department, about, isAnonymous, editedAt: new Date() },
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
        votes: { where: { userId: user.id }, select: { voteType: true } }, bookmarks: { where: { userId: user.id }, select: { id: true } },
      },
    });

    // Anonymity toggle: keep the profile counter and activity log honest,
    // mirroring `updateRecommendation` / `updateJournalReview`.
    if (!supervisor.isAnonymous && isAnonymous) {
      await tx.user.update({
        where: { id: supervisor.authorId },
        data: { supervisorCount: { decrement: 1 } },
      });
      await tx.userActivity.deleteMany({
        where: {
          userId: supervisor.authorId,
          action: "PUBLISHED",
          moduleType: "SUPERVISOR",
          entityId: supervisorId,
        },
      });
    } else if (supervisor.isAnonymous && !isAnonymous) {
      await tx.user.update({
        where: { id: supervisor.authorId },
        data: { supervisorCount: { increment: 1 } },
      });
      await tx.userActivity.create({
        data: {
          userId: supervisor.authorId,
          action: "PUBLISHED",
          moduleType: "SUPERVISOR",
          entityId: supervisorId,
          entityTitle: updated.name,
        },
      });
    }

    return updated;
  });

  // Re-announce to followers now the row is public again — mirrors createSupervisor.
  if (supervisor.isAnonymous && !isAnonymous) {
    await notifyFollowersOfActivity({
      actorId: user.id,
      type: "content-published",
      targetType: "Supervisor",
      targetId: supervisorId,
      title: `${user.email?.split("@")[0] || "Someone"} added a new supervisor`,
      body: `${name}${university ? ` at ${university}` : ""}${department ? ` (${department})` : ""}`,
    });
  }

  // Purge the cached supervisor pages: edit must be visible at once, not after the TTL.
  revalidateContent("SUPERVISOR", supervisor.authorId);

  return { success: true as const, data: updatedSupervisor };
}

export async function deleteSupervisor(supervisorId: string) {
  // Frozen owners may delete own content (read/edit/delete allowed, create blocked).
  const user = await requireCurrentUser("Log in to delete this supervisor.");
  await enforceRateLimit({ namespace: "supervisor:delete", key: user.id, limit: 20, window: "10 m" });

  const supervisor = await prisma.supervisor.findUnique({
    where: { id: supervisorId },
    select: { authorId: true, totalVotes: true, totalComments: true, recommendationCount: true, isAnonymous: true },
  });

  if (!supervisor) {
    throw new Error("Supervisor not found.");
  }
  const deletedByType = await resolvePostDeletePermission(
    user.id,
    supervisor.authorId,
  );

  await prisma.$transaction(async (tx) => {
    await tx.supervisor.update({
      where: { id: supervisorId },
      data: { isDeleted: true, deletedByType, deletedById: user.id },
    });

     await tx.user.update({
       where: { id: supervisor.authorId },
       data: {
         ...(supervisor.isAnonymous ? {} : { supervisorCount: { decrement: 1 } }),
       },
     });

     if (supervisor.totalVotes !== 0) {
      await tx.user.update({
        where: { id: supervisor.authorId },
        data: { reputation: { decrement: supervisor.totalVotes } },
      });
    }

    // Hide this content's activity so a deleted supervisor stops appearing in
    // anyone's activity feed at once (not after the cache TTL).
    await hideContentActivity(tx, "SUPERVISOR", supervisorId)
  });

  // Purge the cached supervisor pages: soft delete must be visible at once, not after the TTL.
  revalidateContent("SUPERVISOR", supervisor.authorId);

  // Purge every bookmarker's Bookmarks tab so a soft-deleted supervisor stops
  // inflating their bookmark count or showing a phantom "show more" arrow.
  await revalidateBookmarkersForDeletedContent("SUPERVISOR", supervisorId);

  return { success: true as const, data: { deletedId: supervisorId, isDeleted: true as const, deletedByType, totalComments: supervisor.totalComments, recommendationCount: supervisor.recommendationCount } } as unknown as
    | { success: true; data: { deletedId: string; isDeleted: true; deletedByType: typeof deletedByType; totalComments: number; recommendationCount: number } }
    | { success: false; error: string; message: string };
}
