"use server";

import { cache } from "react";

import { Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import { resolvePostDeletePermission } from "@/lib/deletion";
import { requireCurrentUser, isAuthorizedOrAdmin } from "@/lib/auth";
import { readFormValue } from "@/lib/form";
import { notifyFollowersOfActivity } from "@/lib/notifications";
import { COMMENT_PAGE_SIZE } from "@/lib/constants";

export async function createResearchGrant(formData: FormData) {
  const user = await requireCurrentUser(
    "Please log in to share a research grant.",
  );

  const title = readFormValue(formData, "title");
  const amount = readFormValue(formData, "amount");
  const description = readFormValue(formData, "description");
  const applyLink = readFormValue(formData, "applyLink");
  const infoLink = readFormValue(formData, "infoLink");

  const grant = await prisma.$transaction(async (tx) => {
    const newGrant = await tx.researchGrant.create({
      data: {
        title,
        amount: amount || null,
        description,
        applyLink: applyLink || null,
        infoLink: infoLink || null,
        authorId: user.id,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            handle: true,
            avatarUrl: true,
            followers: {
              where: { followerId: user.id },
              select: { followerId: true },
            },
          },
        },
        votes: { where: { userId: user.id }, select: { voteType: true } },
      },
    });

    await tx.userActivity.create({
      data: {
        userId: user.id,
        action: "PUBLISHED",
        moduleType: "RESEARCH_GRANT",
        entityId: newGrant.id,
        entityTitle: newGrant.title,
      },
    });

    await tx.user.update({
      where: { id: user.id },
      data: { researchGrantCount: { increment: 1 }, reputation: { increment: 1 } },
    });

    return newGrant;
  });

  await notifyFollowersOfActivity({
    actorId: user.id,
    type: "content-published",
    targetType: "ResearchGrant",
    targetId: grant.id,
    title: `${user.email?.split("@")[0] || "Someone"} shared a research grant`,
    body: amount ? `${title} - ${amount}` : title,
  });

  return { success: true, data: grant };
}

export async function updateResearchGrant(formData: FormData, grantId: string) {
  const user = await requireCurrentUser("Log in to edit this research grant.");

  const title = readFormValue(formData, "title");
  const amount = readFormValue(formData, "amount");
  const description = readFormValue(formData, "description");
  const applyLink = readFormValue(formData, "applyLink");
  const infoLink = readFormValue(formData, "infoLink");

  const grant = await prisma.researchGrant.findUnique({
    where: { id: grantId },
    select: { authorId: true },
  });

  if (!grant) {
    throw new Error("Research grant not found.");
  }
  if (!(await isAuthorizedOrAdmin(grant.authorId, user.id))) {
    throw new Error("Not authorized to edit this research grant.");
  }

  const updatedGrant = await prisma.researchGrant.update({
    where: { id: grantId },
    data: {
      title,
      amount: amount || null,
      description,
      applyLink: applyLink || null,
      infoLink: infoLink || null,
      editedAt: new Date(),
    },
  });

  return { success: true, data: updatedGrant };
}

export async function deleteResearchGrant(grantId: string) {
  const user = await requireCurrentUser(
    "Log in to delete this research grant.",
  );

  const grant = await prisma.researchGrant.findUnique({
    where: { id: grantId },
    select: { authorId: true, totalVotes: true },
  });

  if (!grant) {
    throw new Error("Research grant not found.");
  }
  const deletedByType = await resolvePostDeletePermission(
    user.id,
    grant.authorId,
  );

  await prisma.$transaction(async (tx) => {
    await tx.researchGrant.update({
      where: { id: grantId },
      data: { isDeleted: true, deletedByType, deletedById: user.id },
    });

     await tx.user.update({
       where: { id: grant.authorId },
       data: { researchGrantCount: { decrement: 1 }, reputation: { decrement: 1 } },
     });

     if (grant.totalVotes !== 0) {
      await tx.user.update({
        where: { id: grant.authorId },
        data: { reputation: { decrement: grant.totalVotes } },
      });
    }
  });

  return { success: true, data: { deletedId: grantId } };
}

export async function getResearchGrants(
  q?: string,
  userId?: string,
  limit = 10,
  cursor?: string,
) {
  const where: Prisma.ResearchGrantWhereInput = {
    isDeleted: false,
    ...(q && {
      OR: [
        { title: { contains: q, mode: Prisma.QueryMode.insensitive } },
        { amount: { contains: q, mode: Prisma.QueryMode.insensitive } },
        { description: { contains: q, mode: Prisma.QueryMode.insensitive } },
        { applyLink: { contains: q, mode: Prisma.QueryMode.insensitive } },
        { infoLink: { contains: q, mode: Prisma.QueryMode.insensitive } },
      ],
    }),
  };

  return prisma.researchGrant.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      title: true,
      amount: true,
      description: true,
      createdAt: true,
      updatedAt: true,
      editedAt: true,
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
      isFrozen: true,
      hasActiveAppeal: true,
      totalComments: true,
      votes: userId
        ? { where: { userId }, select: { userId: true, voteType: true } }
        : false,
    },
  });
}

export const getResearchGrantById = cache(
  async (grantId: string, userId?: string) => {
    return prisma.researchGrant.findUniqueOrThrow({
      where: { id: grantId, isDeleted: false },
      select: {
        id: true,
        title: true,
        amount: true,
        description: true,
        applyLink: true,
        infoLink: true,
        createdAt: true,
        updatedAt: true,
        editedAt: true,
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
        isFrozen: true,
        hasActiveAppeal: true,
        totalComments: true,
        votes: userId
          ? { where: { userId }, select: { voteType: true } }
          : false,
        comments: {
          where: { parentId: null, isDeleted: false },
          // LAZY PAGINATION: first page of parents only; replies load on demand.
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
              select: {
                id: true,
                name: true,
                handle: true,
                avatarUrl: true,
              },
            },
            totalVotes: true,
            totalReplies: true,
            votes: userId
              ? { where: { userId }, select: { userId: true, voteType: true } }
              : false,
            mentions: true,
          },
        },
      },
    });
  },
);
