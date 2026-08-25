"use server";

import { cache } from "react";

import prisma from "@/lib/db";
import { requireCurrentUser, isAuthorizedOrAdmin } from "@/lib/auth";
import { readFormValue } from "@/lib/form";

export async function getSupervisors(
  q?: string,
  userId?: string,
  limit = 10,
  cursor?: string,
) {
  return prisma.supervisor.findMany({
    where: {
      isDeleted: false,
      ...(q && { name: { contains: q, mode: "insensitive" } }),
    },
    take: limit,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      name: true,
      university: true,
      department: true,
      createdAt: true,
      authorId: true,
      author: {
        select: {
          id: true,
          name: true,
          handle: true,
          avatarUrl: true,
          followers: userId
            ? { where: { followerId: userId }, select: { followerId: true } }
            : false,
        },
      },
      totalVotes: true,
      totalComments: true,
      votes: userId ? { where: { userId }, select: { voteType: true } } : false,
      // Zero-compute materialized aggregates (Rule 2): count + avg derive
      // from these scalars. No recommendation rows are fetched.
      recommendationCount: true,
      ratingSum: true,
    },
  });
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
          avatarUrl: true,
          followers: userId
            ? { where: { followerId: userId }, select: { followerId: true } }
            : false,
        },
      },
      totalVotes: true,
      totalComments: true,
      votes: userId ? { where: { userId }, select: { voteType: true } } : false,
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
              avatarUrl: true,
              followers: userId
                ? {
                    where: { followerId: userId },
                    select: { followerId: true },
                  }
                : false,
            },
          },
          totalVotes: true,
          totalComments: true,
          votes: userId
            ? { where: { userId }, select: { voteType: true } }
            : false,
        },
      },
      comments: {
        where: { parentId: null },
        // LAZY PAGINATION: first page of parents only; replies load on demand.
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          content: true,
          createdAt: true,
          updatedAt: true,
          author: {
            select: { id: true, name: true, handle: true, avatarUrl: true },
          },
          totalVotes: true,
          totalReplies: true,
          votes: userId
            ? { where: { userId }, select: { voteType: true } }
            : false,
        },
      },
    },
  });
});

/**
 * Fetch the next batch of recommendations for a supervisor (lazy-loaded carousel).
 */
export async function getSupervisorRecommendations(
  supervisorId: string,
  userId?: string,
  skip: number = 0,
  take: number = 1,
) {
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
          avatarUrl: true,
          followers: userId
            ? { where: { followerId: userId }, select: { followerId: true } }
            : false,
        },
      },
      totalVotes: true,
      totalComments: true,
      votes: userId ? { where: { userId }, select: { voteType: true } } : false,
    },
  });
}

/**
 * Aggregate stats for the supervisor detail page (rating + distribution + ownership).
 */
export async function getSupervisorRecommendationMeta(
  supervisorId: string,
  userId?: string,
) {
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
  const user = await requireCurrentUser("Log in to add a supervisor entry.");

  const name = readFormValue(formData, "name");
  const university = readFormValue(formData, "university");
  const department = readFormValue(formData, "department");
  const about = readFormValue(formData, "about");

  const supervisor = await prisma.$transaction(async (tx) => {
    const newSupervisor = await tx.supervisor.create({
      data: {
        name,
        university,
        department,
        about,
        authorId: user.id,
      },
    });

    await tx.user.update({
      where: { id: user.id },
      data: { supervisorCount: { increment: 1 } },
    });

    return newSupervisor;
  });

  return { success: true, data: supervisor };
}

export async function updateSupervisor(
  formData: FormData,
  supervisorId: string,
) {
  const user = await requireCurrentUser("Log in to edit this supervisor.");

  const name = readFormValue(formData, "name");
  const university = readFormValue(formData, "university");
  const department = readFormValue(formData, "department");
  const about = readFormValue(formData, "about");

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
  });

  return { success: true, data: updatedSupervisor };
}

export async function deleteSupervisor(supervisorId: string) {
  const user = await requireCurrentUser("Log in to delete this supervisor.");

  const supervisor = await prisma.supervisor.findUnique({
    where: { id: supervisorId },
    select: { authorId: true, totalVotes: true },
  });

  if (!supervisor) {
    throw new Error("Supervisor not found.");
  }
  if (!(await isAuthorizedOrAdmin(supervisor.authorId, user.id))) {
    throw new Error("Not authorized to delete this supervisor.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.supervisor.update({
      where: { id: supervisorId },
      data: { isDeleted: true },
    });

    await tx.user.update({
      where: { id: supervisor.authorId },
      data: { supervisorCount: { decrement: 1 } },
    });

    if (supervisor.totalVotes !== 0) {
      await tx.user.update({
        where: { id: supervisor.authorId },
        data: { reputation: { decrement: supervisor.totalVotes } },
      });
    }
  });

  return { success: true, data: { deletedId: supervisorId } };
}
