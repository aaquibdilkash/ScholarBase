'use server'

import prisma from '@/lib/db'
import { requireCurrentUser, isAuthorizedOrAdmin } from '@/lib/auth'
import { readFormValue } from '@/lib/form'
import { revalidatePath } from 'next/cache';

// Shared select for a single recommendation in the supervisor detail carousel.
const recommendationSelect = (userId?: string) => ({
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
  author: {
    include: {
      followers: userId
        ? {
          where: { followerId: userId },
          select: { followerId: true },
        }
        : false,
    },
  },
  votes: { select: { userId: true, voteType: true } },
  _count: { select: { comments: true, votes: true } },
});

// For an unknown reason, prisma.$transaction seems to need the unwrapped
// version of this, while `include` and spreads need the wrapped version.
const recommendationInclude = (userId?: string) => ({
  select: recommendationSelect(userId),
});


export async function getSupervisors(q?: string, userId?: string, limit = 20, cursor?: string) {
  return prisma.supervisor.findMany({
    where: q ? { name: { contains: q, mode: "insensitive" } } : {},
    take: limit,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      author: {
        include: {
          followers: userId
            ? {
              where: { followerId: userId },
              select: { followerId: true },
            }
            : false,
        },
      },
      recommendations: true,
      votes: {
        select: { id: true, createdAt: true, userId: true, voteType: true, supervisorId: true },
      },
      _count: {
        select: {
          comments: true,
          votes: true,
        },
      },
    },
  });
}

export async function getSupervisor(id: string, userId?: string) {
  return prisma.supervisor.findUnique({
    where: { id },
    include: {
      author: {
        include: {
          followers: userId
            ? {
              where: { followerId: userId },
              select: { followerId: true },
            }
            : false,
        },
      },
recommendations: {
        ...recommendationInclude(userId),
        take: 1,
        orderBy: { createdAt: "desc" },
      },
      comments: {
        where: { parentId: null },
        orderBy: { createdAt: "desc" },
        include: {
          author: true,
          votes: { select: { userId: true, voteType: true } },
          _count: { select: { votes: true } },
          replies: {
            orderBy: { createdAt: "desc" },
            include: {
              author: true,
              votes: { select: { userId: true, voteType: true } },
              _count: { select: { votes: true } },
            },
          },
        },
      },
      votes: {
        select: { userId: true, voteType: true },
      },
      _count: { select: { votes: true, recommendations: true } },
    },
  });
}

/**
 * Fetch the next batch of recommendations for a supervisor (lazy-loaded carousel).
 * Mirrors the profile content tab's paginated loading pattern.
 */
export async function getSupervisorRecommendations(
  supervisorId: string,
  userId?: string,
  skip: number = 0,
  take: number = 1,
) {
  return prisma.recommendation.findMany({
    where: { supervisorId },
    ...recommendationInclude(userId),
    skip,
    take,
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Aggregate stats for the supervisor detail page (rating + distribution + ownership),
 * computed without loading every recommendation into the carousel.
 */
export async function getSupervisorRecommendationMeta(
  supervisorId: string,
  userId?: string,
) {
  const [recommendations, total] = await Promise.all([
    prisma.recommendation.findMany({
      where: { supervisorId },
      select: { rating: true, authorId: true },
    }),
    prisma.recommendation.count({ where: { supervisorId } }),
  ]);

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
  };
}

export async function createSupervisor(formData: FormData) {
  const user = await requireCurrentUser('Log in to add a supervisor entry.')

  const name = readFormValue(formData, 'name')
  const university = readFormValue(formData, 'university')
  const department = readFormValue(formData, 'department')
  const about = readFormValue(formData, 'about')

  const supervisor = await prisma.supervisor.create({
    data: {
      name,
      university,
      department,
      about,
      // authorId is required in schema; set it explicitly from the current user
      authorId: user.id,
    },
  })

  return { success: true, redirect: `/supervisor/${supervisor.id}` }
}

export async function updateSupervisor(formData: FormData, supervisorId: string) {
  const user = await requireCurrentUser('Log in to edit this supervisor.')

  const name = readFormValue(formData, 'name')
  const university = readFormValue(formData, 'university')
  const department = readFormValue(formData, 'department')
  const about = readFormValue(formData, 'about')

  const supervisor = await prisma.supervisor.findUnique({
    where: { id: supervisorId },
    select: { authorId: true },
  })

  if (!supervisor) return
  if (!await isAuthorizedOrAdmin(supervisor.authorId, user.id)) {
    throw new Error('Not authorized to edit this supervisor.')
  }

  await prisma.supervisor.update({
    where: { id: supervisorId },
    data: { name, university, department, about },
  })

  return { success: true, redirect: `/supervisor/${supervisorId}` }
}



export async function deleteSupervisor(supervisorId: string) {
  const user = await requireCurrentUser('Log in to delete this supervisor.')

  const supervisor = await prisma.supervisor.findUnique({
    where: { id: supervisorId },
    select: { authorId: true },
  })

  if (!supervisor) return
  if (!await isAuthorizedOrAdmin(supervisor.authorId, user.id)) {
    throw new Error('Not authorized to delete this supervisor.')
  }

  await prisma.supervisor.delete({ where: { id: supervisorId } })
  revalidatePath('/supervisor')
  return { redirect: '/supervisor' }
}

