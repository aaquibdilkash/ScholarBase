"use server";

import { cache } from "react";

import { Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import { resolvePostDeletePermission } from "@/lib/deletion";
import { requireCurrentUser, isAuthorizedOrAdmin } from "@/lib/auth";
import { readFormValue } from "@/lib/form";
import { notifyFollowersOfActivity } from "@/lib/notifications";
import { COMMENT_PAGE_SIZE } from "@/lib/constants";

export async function getAdmissions(
  q?: string,
  userId?: string,
  limit = 10,
  cursor?: string,
) {
  const where: Prisma.PhdAdmissionWhereInput = {
    isDeleted: false,
    ...(q && {
      OR: [
        { university: { contains: q, mode: Prisma.QueryMode.insensitive } },
        { department: { contains: q, mode: Prisma.QueryMode.insensitive } },
        { description: { contains: q, mode: Prisma.QueryMode.insensitive } },
      ],
    }),
  };

  return prisma.phdAdmission.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      university: true,
      department: true,
      deadline: true,
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
      isFrozen: true,
      hasActiveAppeal: true,
      totalComments: true,
      votes: userId ? { where: { userId }, select: { voteType: true } } : false,
    },
  });
}

export const getAdmission = cache(async (id: string, userId?: string) => {
  return prisma.phdAdmission.findUnique({
    where: { id, isDeleted: false },
    select: {
      id: true,
      university: true,
      department: true,
      deadline: true,
      description: true,
      notificationLink: true,
      applyLink: true,
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
      isFrozen: true,
      hasActiveAppeal: true,
      totalComments: true,
      votes: userId ? { where: { userId }, select: { voteType: true } } : false,
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
            ? { where: { userId }, select: { voteType: true } }
            : false,
          mentions: true,
        },
      },
    },
  });
});

export async function createPhdAdmission(formData: FormData) {
  const user = await requireCurrentUser("Please log in to submit details.");

  const university = readFormValue(formData, "university");
  const department = readFormValue(formData, "department");
  const deadline = new Date(readFormValue(formData, "deadline"));
  const description = readFormValue(formData, "description");
  const notificationLink = readFormValue(formData, "notificationLink");
  const applyLink = readFormValue(formData, "applyLink");

  if (!notificationLink || !applyLink) {
    throw new Error("Notification and Apply links are required.");
  }

  const admission = await prisma.$transaction(async (tx) => {
    const newAdmission = await tx.phdAdmission.create({
      data: {
        university,
        department,
        deadline,
        description,
        notificationLink,
        applyLink,
        authorId: user.id,
      },
    });

    await tx.userActivity.create({
      data: {
        userId: user.id,
        action: "PUBLISHED",
        moduleType: "PHD_ADMISSION",
        entityId: newAdmission.id,
        entityTitle: `${newAdmission.department} at ${newAdmission.university}`,
      },
    });

    await tx.user.update({
      where: { id: user.id },
      data: { phdAdmissionCount: { increment: 1 } },
    });

    return newAdmission;
  });

  await notifyFollowersOfActivity({
    actorId: user.id,
    type: "content-published",
    targetType: "PhdAdmission",
    targetId: admission.id,
    title: `${user.email?.split("@")[0] || "Someone"} posted a new PhD admission`,
    body: `${department} at ${university} - Deadline: ${deadline.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`,
  });

  return { success: true, data: admission };
}

export async function updatePhdAdmission(
  formData: FormData,
  admissionId: string,
) {
  const user = await requireCurrentUser("Log in to edit this admission.");

  const university = readFormValue(formData, "university");
  const department = readFormValue(formData, "department");
  const deadline = new Date(readFormValue(formData, "deadline"));
  const description = readFormValue(formData, "description");
  const notificationLink = readFormValue(formData, "notificationLink");
  const applyLink = readFormValue(formData, "applyLink");

  if (!notificationLink || !applyLink) {
    throw new Error("Notification and Apply links are required.");
  }

  const admission = await prisma.phdAdmission.findUnique({
    where: { id: admissionId },
    select: { authorId: true },
  });

  if (!admission) {
    throw new Error("Admission not found.");
  }
  if (!(await isAuthorizedOrAdmin(admission.authorId, user.id))) {
    throw new Error("Not authorized to edit this admission.");
  }

  const updatedAdmission = await prisma.phdAdmission.update({
    where: { id: admissionId },
    data: {
      university,
      department,
      deadline,
      description,
      notificationLink,
      applyLink,
      editedAt: new Date(),
    },
  });

  return { success: true, data: updatedAdmission };
}

export async function deletePhdAdmission(admissionId: string) {
  const user = await requireCurrentUser("Log in to delete this admission.");

  const admission = await prisma.phdAdmission.findUnique({
    where: { id: admissionId },
    select: { authorId: true, totalVotes: true },
  });

  if (!admission) {
    throw new Error("Admission not found.");
  }
  const deletedByType = await resolvePostDeletePermission(
    user.id,
    admission.authorId,
  );

  await prisma.$transaction(async (tx) => {
    await tx.phdAdmission.update({
      where: { id: admissionId },
      data: { isDeleted: true, deletedByType, deletedById: user.id },
    });

    await tx.user.update({
      where: { id: admission.authorId },
      data: { phdAdmissionCount: { decrement: 1 } },
    });

    if (admission.totalVotes !== 0) {
      await tx.user.update({
        where: { id: admission.authorId },
        data: { reputation: { decrement: admission.totalVotes } },
      });
    }
  });

  return { success: true, data: { deletedId: admissionId } };
}

export async function getLatestAdmissions(count: number, userId?: string) {
  return prisma.phdAdmission.findMany({
    where: {
      deadline: {
        gte: new Date(),
      },
      isDeleted: false,
    },
    take: count,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      university: true,
      department: true,
      deadline: true,
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
      isFrozen: true,
      hasActiveAppeal: true,
      totalComments: true,
      votes: userId ? { where: { userId }, select: { voteType: true } } : false,
    },
  });
}
