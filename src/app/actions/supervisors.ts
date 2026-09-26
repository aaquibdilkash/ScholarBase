"use server";

import type { SupervisorWithAuthor } from "@/types/cards";

import {
  loadContentPage,
  revalidateContent,
} from "@/lib/tri-split/modules/registry";

import { cache } from "react";

import prisma from "@/lib/db";
import { resolvePostDeletePermission } from "@/lib/deletion";
import { requireCurrentUser, requireActiveUser, isAuthorizedOrAdmin, getCurrentUser } from "@/lib/auth";
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
      totalComments: true,
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
    where: { supervisorId, isDeleted: false },
    select: { id: true, rating: true, authorId: true },
  });

  const total = recommendations.length;
  const avgRating =
    total > 0
      ? recommendations.reduce((sum, r) => sum + r.rating, 0) / total
      : 0;
  const ratingDistribution = [5, 4, 3, 2, 1].map((stars) => {
    const count = recommendations.filter((r) => r.rating === stars).length;
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
    hasUserRecommendation: !!(
      userId && recommendations.some((r) => r.authorId === userId)
    ),
    // Id of the caller's own active recommendation (for "Edit your recommendation" UX)
    userRecommendationId:
      recommendations.find((r) => r.authorId === userId)?.id ?? null,
  };
}

export async function createSupervisor(formData: FormData) {
  const user = await requireActiveUser("Log in to add a supervisor entry.");
  await enforceRateLimit({ namespace: "supervisor:create", key: user.id, limit: 10, window: "10 m" });

  const name = readFormValue(formData, "name");
  const university = readFormValue(formData, "university");
  const department = readFormValue(formData, "department");
  const about = readFormValue(formData, "about");
  assertRichTextWithinLimit(about, MAX_SUPERVISOR_ABOUT, "About");

  const supervisor = await prisma.$transaction(async (tx) => {
    const newSupervisor = await tx.supervisor.create({
      data: {
        name,
        university,
        department,
        about,
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

    await tx.user.update({
      where: { id: user.id },
      data: { supervisorCount: { increment: 1 }, reputation: { increment: 1 } },
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

    return newSupervisor;
  });

  // Purge the cached supervisor pages: publish must be visible at once, not after the TTL.
  revalidateContent("SUPERVISOR");

  return { success: true, data: supervisor };
}

export async function updateSupervisor(
  formData: FormData,
  supervisorId: string,
) {
  const user = await requireCurrentUser("Log in to edit this supervisor.");
  await enforceRateLimit({ namespace: "supervisor:edit", key: user.id, limit: 20, window: "10 m" });

  const name = readFormValue(formData, "name");
  const university = readFormValue(formData, "university");
  const department = readFormValue(formData, "department");
  const about = readFormValue(formData, "about");
  assertRichTextWithinLimit(about, MAX_SUPERVISOR_ABOUT, "About");

  const supervisor = await prisma.supervisor.findUnique({
    where: { id: supervisorId },
    select: { authorId: true },
  });

  if (!supervisor) {
    throw new Error("Supervisor not found.");
  }
  if (!(await isAuthorizedOrAdmin(supervisor.authorId, user.id))) {
    throw new Error("Not authorized to edit this supervisor.");
  }

  const updatedSupervisor = await prisma.supervisor.update({
    where: { id: supervisorId },
    data: { name, university, department, about, editedAt: new Date() },
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

  // Purge the cached supervisor pages: edit must be visible at once, not after the TTL.
  revalidateContent("SUPERVISOR");

  return { success: true, data: updatedSupervisor };
}

export async function deleteSupervisor(supervisorId: string) {
  const user = await requireCurrentUser("Log in to delete this supervisor.");
  await enforceRateLimit({ namespace: "supervisor:delete", key: user.id, limit: 20, window: "10 m" });

  const supervisor = await prisma.supervisor.findUnique({
    where: { id: supervisorId },
    select: { authorId: true, totalVotes: true },
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
       data: { supervisorCount: { decrement: 1 }, reputation: { decrement: 1 } },
     });

     if (supervisor.totalVotes !== 0) {
      await tx.user.update({
        where: { id: supervisor.authorId },
        data: { reputation: { decrement: supervisor.totalVotes } },
      });
    }
  });

  // Purge the cached supervisor pages: soft delete must be visible at once, not after the TTL.
  revalidateContent("SUPERVISOR");

  return { success: true, data: { deletedId: supervisorId } };
}
