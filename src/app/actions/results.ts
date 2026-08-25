"use server";

import { cache } from "react";

import { Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import { requireCurrentUser, isAuthorizedOrAdmin } from "@/lib/auth";
import { readFormValue, readOptionalFormValue } from "@/lib/form";
import { notifyFollowersOfActivity } from "@/lib/notifications";

export async function getResults(
  q?: string,
  userId?: string,
  limit = 10,
  cursor?: string,
) {
  const where: Prisma.ResultWhereInput = {
    isDeleted: false,
    ...(q && {
      OR: [
        { title: { contains: q, mode: Prisma.QueryMode.insensitive } },
        { description: { contains: q, mode: Prisma.QueryMode.insensitive } },
        { category: { contains: q, mode: Prisma.QueryMode.insensitive } },
        { conductingBody: { contains: q, mode: Prisma.QueryMode.insensitive } },
        { session: { contains: q, mode: Prisma.QueryMode.insensitive } },
      ],
    }),
  };

  return prisma.result.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      title: true,
      description: true,
      type: true,
      category: true,
      conductingBody: true,
      session: true,
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
      totalComments: true,
      votes: userId ? { where: { userId }, select: { voteType: true } } : false,
    },
  });
}

export const getResult = cache(async (id: string, userId?: string) => {
  return prisma.result.findUnique({
    where: { id, isDeleted: false },
    select: {
      id: true,
      title: true,
      description: true,
      type: true,
      category: true,
      conductingBody: true,
      session: true,
      notificationLink: true,
      resultLink: true,
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
      totalComments: true,
      votes: userId ? { where: { userId }, select: { voteType: true } } : false,
      comments: {
        where: { parentId: null },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          content: true,
          createdAt: true,
          updatedAt: true,
          editedAt: true,
          parentId: true,
          authorId: true,
          author: {
            select: { id: true, name: true, handle: true, avatarUrl: true },
          },
          totalVotes: true,
          totalReplies: true,
          votes: userId
            ? { where: { userId }, select: { voteType: true } }
            : false,
          replies: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              content: true,
              createdAt: true,
              updatedAt: true,
              editedAt: true,
              parentId: true,
              authorId: true,
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
      },
    },
  });
});

export async function createResult(formData: FormData) {
  const user = await requireCurrentUser("Please log in to submit details.");

  const title = readFormValue(formData, "title");
  const description = readFormValue(formData, "description");
  const type = readFormValue(formData, "type");
  const category = readOptionalFormValue(formData, "category");
  const conductingBody = readOptionalFormValue(formData, "conductingBody");
  const session = readOptionalFormValue(formData, "session");
  const notificationLink = readOptionalFormValue(formData, "notificationLink");
  const resultLink = readOptionalFormValue(formData, "resultLink");

  const result = await prisma.$transaction(async (tx) => {
    const newResult = await tx.result.create({
      data: {
        title,
        description,
        type,
        category,
        conductingBody,
        session,
        notificationLink,
        resultLink,
        authorId: user.id,
      },
    });

    await tx.userActivity.create({
      data: {
        userId: user.id,
        action: "PUBLISHED",
        moduleType: "RESULT",
        entityId: newResult.id,
        entityTitle: newResult.title,
      },
    });
    await tx.user.update({
      where: { id: user.id },
      data: { resultCount: { increment: 1 } },
    });

    return newResult;
  });

  await notifyFollowersOfActivity({
    actorId: user.id,
    type: "content-published",
    targetType: "Result",
    targetId: result.id,
    title: `${user.email?.split("@")[0] || "Someone"} posted a new result`,
    body: `${title}${category ? ` (${category})` : ""}${conductingBody ? ` - ${conductingBody}` : ""}`,
  });

  return { success: true, data: result };
}

export async function updateResult(formData: FormData, resultId: string) {
  const user = await requireCurrentUser("Log in to edit this result.");

  const title = readFormValue(formData, "title");
  const description = readFormValue(formData, "description");
  const type = readFormValue(formData, "type");
  const category = readOptionalFormValue(formData, "category");
  const conductingBody = readOptionalFormValue(formData, "conductingBody");
  const session = readOptionalFormValue(formData, "session");
  const notificationLink = readOptionalFormValue(formData, "notificationLink");
  const resultLink = readOptionalFormValue(formData, "resultLink");

  const result = await prisma.result.findUnique({
    where: { id: resultId },
    select: { authorId: true },
  });

  if (!result) {
    throw new Error("Result not found.");
  }
  if (!(await isAuthorizedOrAdmin(result.authorId, user.id))) {
    throw new Error("Not authorized to edit this result.");
  }

  const updatedResult = await prisma.result.update({
    where: { id: resultId },
    data: {
      title,
      description,
      type,
      category,
      conductingBody,
      session,
      notificationLink,
      resultLink,
      editedAt: new Date(),
    },
  });

  return { success: true, data: updatedResult };
}

export async function deleteResult(resultId: string) {
  const user = await requireCurrentUser("Log in to delete this result.");

  const result = await prisma.result.findUnique({
    where: { id: resultId },
    select: { authorId: true, totalVotes: true },
  });

  if (!result) {
    throw new Error("Result not found.");
  }
  if (!(await isAuthorizedOrAdmin(result.authorId, user.id))) {
    throw new Error("Not authorized to delete this result.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.result.update({
      where: { id: resultId },
      data: { isDeleted: true },
    });

    await tx.user.update({
      where: { id: result.authorId },
      data: { resultCount: { decrement: 1 } },
    });

    if (result.totalVotes !== 0) {
      await tx.user.update({
        where: { id: result.authorId },
        data: { reputation: { decrement: result.totalVotes } },
      });
    }
  });

  return { success: true, data: { deletedId: resultId } };
}
