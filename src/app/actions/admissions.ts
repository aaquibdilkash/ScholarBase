"use server";

import { getCurrentUser } from "@/lib/auth";

import type { AdmissionWithAuthor } from "@/types/cards";

import {
  loadContentPage,
  revalidateContent,
} from "@/lib/tri-split/modules/registry";

import { cache } from "react";

import prisma from "@/lib/db";
import { resolvePostDeletePermission } from "@/lib/deletion";
import { requireActiveUser, isAuthorizedOrAdmin } from "@/lib/auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import { readFormValue, assertRichTextWithinLimit } from "@/lib/form";
import { notifyFollowersOfActivity } from "@/lib/notifications";
import { validateExternalUrl } from "@/lib/external-url";
import { COMMENT_PAGE_SIZE, MAX_ADMISSION_DESCRIPTION } from "@/lib/constants";
import { VISIBLE_PARENT_COMMENT_WHERE } from "@/lib/comment-visibility";

/**
 * Loads one page of phd admission rows for the
 * *current* viewer.
 *
 * Identity comes from the session, server-side — never from a client argument.
 * (This loader used to accept `userId` from the browser, so any caller could
 * read another user's vote / bookmark / follow state.)
 *
 * The cached viewer-agnostic batch plus the single-statement live overlay live
 * in `@/lib/tri-split/modules/registry`.
 */
export async function getAdmissions(
  q?: string,
  limit = 10,
  cursor?: string,
) {
  return loadContentPage("PHD_ADMISSION", { query: q, pageSize: limit, cursor }) as Promise<
  AdmissionWithAuthor[]
>;
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
      comments: {
        where: VISIBLE_PARENT_COMMENT_WHERE,
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
              avatarUrl: true, institutionVerifiedAt: true,
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
  const user = await requireActiveUser("Please log in to submit details.");
  await enforceRateLimit({ namespace: "admission:create", key: user.id, limit: 10, window: "10 m" });

  const university = readFormValue(formData, "university");
  const department = readFormValue(formData, "department");
  const deadline = new Date(readFormValue(formData, "deadline"));
  const description = readFormValue(formData, "description");
  assertRichTextWithinLimit(description, MAX_ADMISSION_DESCRIPTION, "Description");
  const notificationLink = readFormValue(formData, "notificationLink");
  const applyLink = readFormValue(formData, "applyLink");
  const safeNotificationLink = validateExternalUrl(notificationLink, "Notification link");
  const safeApplyLink = validateExternalUrl(applyLink, "Apply link");

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
        notificationLink: safeNotificationLink,
        applyLink: safeApplyLink,
        authorId: user.id,
      },
      include: { author: { select: { id: true, name: true, handle: true, avatarUrl: true, institutionVerifiedAt: true, followers: { where: { followerId: user.id }, select: { followerId: true } } } }, votes: { where: { userId: user.id }, select: { voteType: true } }, bookmarks: { where: { userId: user.id }, select: { id: true } } },
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
      data: { phdAdmissionCount: { increment: 1 }, reputation: { increment: 1 } },
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

  // Purge the cached phd admission pages: publish must be visible at once, not after the TTL.
  revalidateContent("PHD_ADMISSION");

  return { success: true, data: admission };
}

export async function updatePhdAdmission(
  formData: FormData,
  admissionId: string,
) {
  const user = await requireActiveUser("Log in to edit this admission.");
  await enforceRateLimit({ namespace: "admission:edit", key: user.id, limit: 20, window: "10 m" });

  const university = readFormValue(formData, "university");
  const department = readFormValue(formData, "department");
  const deadline = new Date(readFormValue(formData, "deadline"));
  const description = readFormValue(formData, "description");
  assertRichTextWithinLimit(description, MAX_ADMISSION_DESCRIPTION, "Description");
  const notificationLink = readFormValue(formData, "notificationLink");
  const applyLink = readFormValue(formData, "applyLink");
  const safeNotificationLink = validateExternalUrl(notificationLink, "Notification link");
  const safeApplyLink = validateExternalUrl(applyLink, "Apply link");

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
      notificationLink: safeNotificationLink,
      applyLink: safeApplyLink,
      editedAt: new Date(),
    },
  });

  // Purge the cached phd admission pages: edit must be visible at once, not after the TTL.
  revalidateContent("PHD_ADMISSION");

  return { success: true, data: updatedAdmission };
}

export async function deletePhdAdmission(admissionId: string) {
  const user = await requireActiveUser("Log in to delete this admission.");
  await enforceRateLimit({ namespace: "admission:delete", key: user.id, limit: 20, window: "10 m" });

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
       data: { phdAdmissionCount: { decrement: 1 }, reputation: { decrement: 1 } },
     });

     if (admission.totalVotes !== 0) {
      await tx.user.update({
        where: { id: admission.authorId },
        data: { reputation: { decrement: admission.totalVotes } },
      });
    }
  });

  // Purge the cached phd admission pages: soft delete must be visible at once, not after the TTL.
  revalidateContent("PHD_ADMISSION");

  return { success: true, data: { deletedId: admissionId } };
}

export async function getLatestAdmissions(count: number) {
  // Identity comes from the session, server-side — never from a client
  // argument. This used to accept `userId` and filter the author's
  // `followers` relation by it, so any caller could read another user's
  // follow relationships.
  const user = await getCurrentUser();
  const userId = user?.id;

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
    },
  });
}
