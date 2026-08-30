"use server";

import { cache } from "react";

import { Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import { requireCurrentUser, isAuthorizedOrAdmin } from "@/lib/auth";
import { readFormValue } from "@/lib/form";
import { notifyFollowersOfActivity } from "@/lib/notifications";
import { COMMENT_PAGE_SIZE } from "@/lib/constants";

export async function getVacancies(
  q?: string,
  userId?: string,
  limit = 10,
  cursor?: string,
) {
  const where = q
    ? {
        OR: [
          { title: { contains: q, mode: Prisma.QueryMode.insensitive } },
          { institution: { contains: q, mode: Prisma.QueryMode.insensitive } },
          { description: { contains: q, mode: Prisma.QueryMode.insensitive } },
        ],
      }
    : {};

  return prisma.jobVacancy.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      title: true,
      institution: true,
      deadline: true,
      description: true,
      notificationLink: true,
      applyLink: true,
      createdAt: true,
      updatedAt: true,
      editedAt: true,
      totalVotes: true,
      isFrozen: true,
      totalComments: true,
      authorId: true,
      author: {
        select: {
          id: true,
          name: true,
          handle: true,
          avatarUrl: true,
          ...(userId
            ? {
                followers: {
                  where: { followerId: userId },
                  select: { followerId: true },
                },
              }
            : {}),
        },
      },
      votes: userId ? { where: { userId }, select: { voteType: true } } : false,
    },
  });
}

export const getVacancyById = cache(async (id: string, userId?: string) => {
  return prisma.jobVacancy.findUnique({
    where: { id: id },
    select: {
      id: true,
      title: true,
      institution: true,
      deadline: true,
      description: true,
      notificationLink: true,
      applyLink: true,
      createdAt: true,
      updatedAt: true,
      editedAt: true,
      totalVotes: true,
      isFrozen: true,
      totalComments: true,
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
            comments: {
        where: { parentId: null, isDeleted: false },
        // LAZY PAGINATION: first page of parents only; replies load on demand.
        take: COMMENT_PAGE_SIZE + 1,
        select: {
          isDeleted: true,
          isFrozen: true,
          id: true,
          content: true,
          createdAt: true,
          updatedAt: true,
          editedAt: true,
          parentId: true,
          totalVotes: true,
          totalReplies: true,
          author: {
            select: { id: true, name: true, handle: true, avatarUrl: true },
          },
          votes: userId
            ? { where: { userId }, select: { voteType: true } }
            : false,
          mentions: true,
        },
        orderBy: { createdAt: "desc" },
      },
      votes: userId ? { where: { userId }, select: { voteType: true } } : false,
    },
  });
});

export async function createJobVacancy(formData: FormData) {
  const user = await requireCurrentUser("Please log in to submit details.");

  const title = readFormValue(formData, "title");
  const institution = readFormValue(formData, "institution");
  const deadline = new Date(readFormValue(formData, "deadline"));
  const description = readFormValue(formData, "description");
  const notificationLink = readFormValue(formData, "notificationLink");
  const applyLink = readFormValue(formData, "applyLink");

  if (!notificationLink || !applyLink) {
    throw new Error("Notification and Apply links are required.");
  }

  const vacancy = await prisma.$transaction(async (tx) => {
    const newVacancy = await tx.jobVacancy.create({
      data: {
        title,
        institution,
        deadline,
        description,
        notificationLink,
        applyLink,
        authorId: user.id,
      },
      select: {
        id: true,
        title: true,
        institution: true,
        deadline: true,
        description: true,
        notificationLink: true,
        applyLink: true,
        createdAt: true,
        updatedAt: true,
        editedAt: true,
        totalVotes: true,
        isFrozen: true,
        totalComments: true,
        author: {
          select: { id: true, name: true, handle: true, avatarUrl: true },
        },
      },
    });

    await tx.user.update({
      where: { id: user.id },
      data: { jobVacancyCount: { increment: 1 } },
    });

    return newVacancy;
  });

  await notifyFollowersOfActivity({
    actorId: user.id,
    type: "content-published",
    targetType: "vacancy",
    targetId: vacancy.id,
    title: `${user.email?.split("@")[0] || "Someone"} posted a new academic vacancy`,
    body: `${title} at ${institution} - Apply by ${deadline.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`,
  });

  return { success: true, data: vacancy };
}

export async function updateJobVacancy(formData: FormData, vacancyId: string) {
  const user = await requireCurrentUser("Log in to edit this vacancy.");

  const title = readFormValue(formData, "title");
  const institution = readFormValue(formData, "institution");
  const deadline = new Date(readFormValue(formData, "deadline"));
  const description = readFormValue(formData, "description");
  const notificationLink = readFormValue(formData, "notificationLink");
  const applyLink = readFormValue(formData, "applyLink");

  if (!notificationLink || !applyLink) {
    throw new Error("Notification and Apply links are required.");
  }

  const vacancy = await prisma.jobVacancy.findUnique({
    where: { id: vacancyId },
    select: { authorId: true },
  });

  if (!vacancy) return;
  if (!(await isAuthorizedOrAdmin(vacancy.authorId, user.id))) {
    throw new Error("Not authorized to edit this vacancy.");
  }

  const updatedVacancy = await prisma.jobVacancy.update({
    where: { id: vacancyId },
    data: {
      title,
      institution,
      deadline,
      description,
      notificationLink,
      applyLink,
      editedAt: new Date(),
    },
    select: {
      id: true,
      title: true,
      institution: true,
      deadline: true,
      description: true,
      notificationLink: true,
      applyLink: true,
      createdAt: true,
      updatedAt: true,
      editedAt: true,
      totalVotes: true,
      isFrozen: true,
      totalComments: true,
      author: {
        select: { id: true, name: true, handle: true, avatarUrl: true },
      },
    },
  });

  return { success: true, data: updatedVacancy };
}

export async function deleteJobVacancy(vacancyId: string) {
  const user = await requireCurrentUser("Log in to delete this vacancy.");

  const vacancy = await prisma.jobVacancy.findUnique({
    where: { id: vacancyId },
    select: { authorId: true, totalVotes: true },
  });

  if (!vacancy) return;
  if (!(await isAuthorizedOrAdmin(vacancy.authorId, user.id))) {
    throw new Error("Not authorized to delete this vacancy.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.jobVacancy.update({
      where: { id: vacancyId },
      data: { isDeleted: true },
    });

    await tx.user.update({
      where: { id: vacancy.authorId },
      data: { jobVacancyCount: { decrement: 1 } },
    });

    if (vacancy.totalVotes !== 0) {
      await tx.user.update({
        where: { id: vacancy.authorId },
        data: { reputation: { decrement: vacancy.totalVotes } },
      });
    }
  });

  return { success: true, data: { deletedId: vacancyId } };
}

export async function getLatestVacancies(count: number, userId?: string) {
  return prisma.jobVacancy.findMany({
    where: {
      deadline: {
        gte: new Date(),
      },
    },
    take: count,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      institution: true,
      deadline: true,
      description: true,
      notificationLink: true,
      applyLink: true,
      createdAt: true,
      updatedAt: true,
      editedAt: true,
      totalVotes: true,
      isFrozen: true,
      totalComments: true,
      author: {
        select: {
          id: true,
          name: true,
          handle: true,
          avatarUrl: true,
          ...(userId
            ? {
                followers: {
                  where: { followerId: userId },
                  select: { followerId: true },
                },
              }
            : {}),
        },
      },
      votes: userId ? { where: { userId }, select: { voteType: true } } : false,
    },
  });
}
