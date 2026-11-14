"use server";

import type { AcademicPositionWithAuthor } from "@/types/cards";

import {
  loadContentPage,
  revalidateContent,
} from "@/lib/tri-split/modules/registry";
import { revalidateBookmarkersForDeletedContent } from "@/lib/tri-split/modules/profile-tab";
import { hideContentActivity } from "@/lib/activity";

import { cache } from "react";

import prisma from "@/lib/db";
import { resolvePostDeletePermission } from "@/lib/deletion";
import { getActiveUser, requireCurrentUser, isAuthorizedOrAdmin } from "@/lib/auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import { readFormValue, readOptionalFormValue, assertRichTextWithinLimit } from "@/lib/form";
import { notifyFollowersOfActivity, deleteAllNotificationsForContent } from "@/lib/notifications";
import { validateExternalUrl } from "@/lib/external-url";
import {
  COMMENT_PAGE_SIZE,
  MAX_POSITION_DESCRIPTION,
  MAX_POSITION_DEPARTMENT,
  MAX_POSITION_SUBJECT,
  MAX_POSITION_SALARY,
  MAX_POSITION_DURATION,
  MAX_POSITION_LOCATION,
} from "@/lib/constants";
import { parsePositionType, parseEmploymentType } from "@/lib/academic-positions";
import { VISIBLE_PARENT_COMMENT_WHERE } from "@/lib/comment-visibility";
import { promoteContentImages, findRemovedImagePaths } from "@/lib/content-images";
import { extractCoverImagePath, deleteContentImagePaths } from "@/lib/supabase-storage";

/**
 * Normalizes an optional short-text field: trims, enforces the max length,
 * and maps empty/missing to `null` so the DB stays clean (no "" rows).
 */
function readOptionalShortText(
  formData: FormData,
  key: string,
  maxLength: number,
  label: string,
): string | null {
  const raw = readOptionalFormValue(formData, key)?.trim() ?? "";
  if (!raw) return null;
  if (raw.length > maxLength) {
    throw new Error(`${label} is too long (max ${maxLength} characters).`);
  }
  return raw;
}

/**
 * Optional ISO date field: empty/missing maps to `null`, anything unparsable
 * is rejected instead of being persisted as an Invalid Date.
 */
function readOptionalDate(formData: FormData, key: string): Date | null {
  const raw = readOptionalFormValue(formData, key)?.trim() ?? "";
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid start date.");
  }
  return date;
}

/**
 * Loads one page of academic position rows for the
 * *current* viewer.
 *
 * Identity comes from the session, server-side — never from a client argument.
 * (This loader used to accept `userId` from the browser, so any caller could
 * read another user's vote / bookmark / follow state.)
 *
 * The cached viewer-agnostic batch plus the single-statement live overlay live
 * in `@/lib/tri-split/modules/registry`.
 */
export async function getAcademicPositions(
  q?: string,
  limit = 10,
  cursor?: string,
) {
  return loadContentPage("ACADEMIC_POSITION", { query: q, pageSize: limit, cursor }) as Promise<
  AcademicPositionWithAuthor[]
>;
}

export const getAcademicPositionById = cache(async (id: string, userId?: string) => {
  return prisma.academicPosition.findUnique({
    where: { id: id, isDeleted: false },
    select: {
      id: true,
      title: true,
      institution: true,
      department: true,
      subject: true,
      positionType: true,
      employmentType: true,
      salaryOrStipend: true,
      contractDuration: true,
      startDate: true,
      location: true,
      isRemote: true,
      deadline: true,
      description: true,
      imageUrl: true,
      notificationLink: true,
      applyLink: true,
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
      comments: {
        where: VISIBLE_PARENT_COMMENT_WHERE,
        // LAZY PAGINATION: first page of parents only; replies load on demand.
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
            select: { id: true, name: true, handle: true, avatarUrl: true, institutionVerifiedAt: true },
          },
          votes: userId
            ? { where: { userId }, select: { voteType: true } }
            : false,
          mentions: true,
        },
        orderBy: { createdAt: "desc" },
      },
      votes: userId ? { where: { userId }, select: { voteType: true } } : false,
      bookmarks: userId ? { where: { userId }, select: { id: true } } : false,
    },
  });
});

export async function createAcademicPosition(formData: FormData) {
  const auth = await getActiveUser("Please log in to submit details.");
  if (auth.frozen) return { success: false, error: auth.message, message: auth.message };
  const user = auth.user;
  const writeLimit = await enforceRateLimit({ namespace: "academicPosition:create", key: user.id, limit: 10, window: "10 m" });
  if (!writeLimit.allowed) return { success: false as const, error: writeLimit.error };

  const title = readFormValue(formData, "title");
  const institution = readFormValue(formData, "institution");
  const department = readOptionalShortText(formData, "department", MAX_POSITION_DEPARTMENT, "Department");
  const subject = readOptionalShortText(formData, "subject", MAX_POSITION_SUBJECT, "Subject");
  const positionType = parsePositionType(readFormValue(formData, "positionType"));
  const employmentType = parseEmploymentType(readFormValue(formData, "employmentType"));
  const salaryOrStipend = readOptionalShortText(formData, "salaryOrStipend", MAX_POSITION_SALARY, "Salary");
  const contractDuration = readOptionalShortText(formData, "contractDuration", MAX_POSITION_DURATION, "Contract duration");
  const startDate = readOptionalDate(formData, "startDate");
  const location = readOptionalShortText(formData, "location", MAX_POSITION_LOCATION, "Location");
  const isRemote = readFormValue(formData, "isRemote") === "on";
  const deadline = new Date(readFormValue(formData, "deadline"));
  const description = readFormValue(formData, "description");
  assertRichTextWithinLimit(description, MAX_POSITION_DESCRIPTION, "Description");
  const notificationLink = readFormValue(formData, "notificationLink");
  const applyLink = readFormValue(formData, "applyLink");
  const coverImageUrl = formData.get("coverImageUrl") as string | null;
  let safeNotificationLink: string | null;
  let safeApplyLink: string | null;
  try {
    safeNotificationLink = validateExternalUrl(notificationLink, "Notification link");
    safeApplyLink = validateExternalUrl(applyLink, "Apply link", undefined, true);
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : "Invalid URL." };
  }

  if (!notificationLink || !applyLink) {
    throw new Error("Notification and Apply links are required.");
  }

  // Promote the draft cover image to published before the row is created.
  const promoted = await promoteContentImages({
    coverKind: "position-cover",
    inlineKind: "position-inline",
    imageUrl: coverImageUrl || undefined,
    html: description,
    userId: user.id,
  });
  if (!promoted.ok) {
    return { success: false, error: promoted.error, message: promoted.error };
  }
  const { coverUrl, publishedHtml } = promoted;

  const academicPosition = await prisma.$transaction(async (tx) => {
    const newPosition = await tx.academicPosition.create({
      data: {
        title,
        institution,
        department,
        subject,
        positionType,
        employmentType,
        salaryOrStipend,
        contractDuration,
        startDate,
        location,
        isRemote,
        deadline,
        description: publishedHtml,
        imageUrl: coverUrl,
        notificationLink: safeNotificationLink,
        applyLink: safeApplyLink,
        authorId: user.id,
      },
      select: {
        id: true,
        title: true,
        institution: true,
        department: true,
        subject: true,
        positionType: true,
        employmentType: true,
        salaryOrStipend: true,
        contractDuration: true,
        startDate: true,
        location: true,
        isRemote: true,
        deadline: true,
        description: true,
        notificationLink: true,
        applyLink: true,
        createdAt: true,
        updatedAt: true,
        editedAt: true,
        totalVotes: true,
      totalBookmarks: true,
        isFrozen: true,
        hasActiveAppeal: true,
        totalComments: true,
        authorId: true,
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
      data: { academicPositionCount: { increment: 1 } },
    });

    await tx.userActivity.create({
      data: {
        userId: user.id,
        action: "PUBLISHED",
        moduleType: "ACADEMIC_POSITION",
        entityId: newPosition.id,
        entityTitle: newPosition.title,
      },
    });

    return newPosition;
  });

  await notifyFollowersOfActivity({
    actorId: user.id,
    type: "content-published",
    targetType: "academicPosition",
    targetId: academicPosition.id,
    title: `${user.email?.split("@")[0] || "Someone"} posted a new academic position`,
    body: `${title} at ${institution} - Apply by ${deadline.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`,
  });

  // Purge the cached academic position pages: publish must be visible at once, not after the TTL.
  revalidateContent("ACADEMIC_POSITION", user.id);

  return { success: true, data: academicPosition };
}

export async function updateAcademicPosition(formData: FormData, academicPositionId: string) {
  // Frozen owners may edit (to correct content before appealing).
  const user = await requireCurrentUser("Log in to edit this position.");
  const writeLimit = await enforceRateLimit({ namespace: "academicPosition:edit", key: user.id, limit: 20, window: "10 m" });
  if (!writeLimit.allowed) return { success: false as const, error: writeLimit.error };

  const title = readFormValue(formData, "title");
  const institution = readFormValue(formData, "institution");
  const department = readOptionalShortText(formData, "department", MAX_POSITION_DEPARTMENT, "Department");
  const subject = readOptionalShortText(formData, "subject", MAX_POSITION_SUBJECT, "Subject");
  const positionType = parsePositionType(readFormValue(formData, "positionType"));
  const employmentType = parseEmploymentType(readFormValue(formData, "employmentType"));
  const salaryOrStipend = readOptionalShortText(formData, "salaryOrStipend", MAX_POSITION_SALARY, "Salary");
  const contractDuration = readOptionalShortText(formData, "contractDuration", MAX_POSITION_DURATION, "Contract duration");
  const startDate = readOptionalDate(formData, "startDate");
  const location = readOptionalShortText(formData, "location", MAX_POSITION_LOCATION, "Location");
  const isRemote = readFormValue(formData, "isRemote") === "on";
  const deadline = new Date(readFormValue(formData, "deadline"));
  const description = readFormValue(formData, "description");
  assertRichTextWithinLimit(description, MAX_POSITION_DESCRIPTION, "Description");
  const notificationLink = readFormValue(formData, "notificationLink");
  const applyLink = readFormValue(formData, "applyLink");
  const coverImageUrl = formData.get("coverImageUrl") as string | null;
  let safeNotificationLink: string | null;
  let safeApplyLink: string | null;
  try {
    safeNotificationLink = validateExternalUrl(notificationLink, "Notification link");
    safeApplyLink = validateExternalUrl(applyLink, "Apply link", undefined, true);
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : "Invalid URL." };
  }

  if (!notificationLink || !applyLink) {
    throw new Error("Notification and Apply links are required.");
  }

  const academicPosition = await prisma.academicPosition.findUnique({
    where: { id: academicPositionId },
    select: { authorId: true, imageUrl: true, description: true },
  });

  if (!academicPosition) return;
  if (!(await isAuthorizedOrAdmin(academicPosition.authorId, user.id))) {
    throw new Error("Not authorized to edit this position.");
  }

  // Promote the draft cover image to published before updating.
  const promoted = await promoteContentImages({
    coverKind: "position-cover",
    inlineKind: "position-inline",
    imageUrl: coverImageUrl || undefined,
    html: description,
    userId: user.id,
  });
  if (!promoted.ok) {
    return { success: false, error: promoted.error, message: promoted.error };
  }
  const { coverUrl, publishedHtml } = promoted;

  // Work out which images this edit removes. Every path comes from the
  // position's OWN stored content (or its own stored cover), never from the
  // submitted form.
  const removedPaths = findRemovedImagePaths(
    academicPosition.description,
    publishedHtml,
  );
  const oldCoverPath = extractCoverImagePath(academicPosition.imageUrl);
  const newCoverPath = extractCoverImagePath(coverUrl);
  if (oldCoverPath && oldCoverPath !== newCoverPath) {
    removedPaths.push(oldCoverPath);
  }

  const updatedPosition = await prisma.academicPosition.update({
    where: { id: academicPositionId },
    data: {
      title,
      institution,
      department,
      subject,
      positionType,
      employmentType,
      salaryOrStipend,
      contractDuration,
      startDate,
      location,
      isRemote,
      deadline,
      description: publishedHtml,
      imageUrl: coverUrl,
      notificationLink: safeNotificationLink,
      applyLink: safeApplyLink,
      editedAt: new Date(),
    },
    select: {
      id: true,
      title: true,
      institution: true,
      department: true,
      subject: true,
      positionType: true,
      employmentType: true,
      salaryOrStipend: true,
      contractDuration: true,
      startDate: true,
      location: true,
      isRemote: true,
      deadline: true,
      description: true,
      imageUrl: true,
      notificationLink: true,
      applyLink: true,
      createdAt: true,
      updatedAt: true,
      editedAt: true,
      totalVotes: true,
      totalBookmarks: true,
      isFrozen: true,
      hasActiveAppeal: true,
      totalComments: true,
      author: {
        select: { id: true, name: true, handle: true, avatarUrl: true, institutionVerifiedAt: true },
      },
    },
  });

  // Persist the edit FIRST, then collect the images the edit replaced.
  if (removedPaths.length > 0) {
    await deleteContentImagePaths(removedPaths);
  }

  // Purge the cached academic position pages: edit must be visible at once, not after the TTL.
  revalidateContent("ACADEMIC_POSITION", academicPosition.authorId);

  return { success: true, data: updatedPosition };
}

export async function deleteAcademicPosition(academicPositionId: string) {
  // Frozen owners may delete own content (read/edit/delete allowed, create blocked).
  const user = await requireCurrentUser("Log in to delete this position.");
  const writeLimit = await enforceRateLimit({ namespace: "academicPosition:delete", key: user.id, limit: 20, window: "10 m" });
  if (!writeLimit.allowed) return { success: false as const, error: writeLimit.error };

  const academicPosition = await prisma.academicPosition.findUnique({
    where: { id: academicPositionId },
    select: { authorId: true, totalVotes: true, totalComments: true },
  });

  if (!academicPosition) return;
  const deletedByType = await resolvePostDeletePermission(
    user.id,
    academicPosition.authorId,
  );

  await prisma.$transaction(async (tx) => {
    await tx.academicPosition.update({
      where: { id: academicPositionId },
      data: { isDeleted: true, deletedByType, deletedById: user.id },
    });

     await tx.user.update({
       where: { id: academicPosition.authorId },
       data: { academicPositionCount: { decrement: 1 } },
     });

     if (academicPosition.totalVotes !== 0) {
      await tx.user.update({
        where: { id: academicPosition.authorId },
        data: { reputation: { decrement: academicPosition.totalVotes } },
      });
    }

    // Hide this content's activity so a deleted position stops appearing in
    // anyone's activity feed at once (not after the cache TTL).
    await hideContentActivity(tx, "ACADEMIC_POSITION", academicPositionId)

    // Delete every notification pointing at this position and its comments.
    await deleteAllNotificationsForContent(tx, "ACADEMIC_POSITION", academicPositionId)
  });

  // Purge the cached academic position pages: soft delete must be visible at once, not after the TTL.
  revalidateContent("ACADEMIC_POSITION", academicPosition.authorId);

  // Purge every bookmarker's Bookmarks tab so a soft-deleted post stops
  // inflating their bookmark count or showing a phantom "show more" arrow.
  await revalidateBookmarkersForDeletedContent("ACADEMIC_POSITION", academicPositionId);

  return { success: true, data: { deletedId: academicPositionId, isDeleted: true as const, deletedByType, totalComments: academicPosition.totalComments } };
}
