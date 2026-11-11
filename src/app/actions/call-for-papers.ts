"use server";

import type { CallForPaperWithAuthor } from "@/types/cards";

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
import { COMMENT_PAGE_SIZE, MAX_EVENT_DESCRIPTION } from "@/lib/constants";
import { VISIBLE_PARENT_COMMENT_WHERE } from "@/lib/comment-visibility";

/**
 * Loads one page of research event rows for the
 * *current* viewer.
 *
 * Identity comes from the session, server-side — never from a client argument.
 * (This loader used to accept `userId` from the browser, so any caller could
 * read another user's vote / bookmark / follow state.)
 *
 * The cached viewer-agnostic batch plus the single-statement live overlay live
 * in `@/lib/tri-split/modules/registry`.
 */
export async function getCallForPapers(
  q?: string,
  limit = 10,
  cursor?: string,
) {
  return loadContentPage("CALL_FOR_PAPER", { query: q, pageSize: limit, cursor }) as Promise<
  CallForPaperWithAuthor[]
>;
}

export const getEvent = cache(async (id: string, userId?: string) => {
  return prisma.callForPaper.findUnique({
    where: { id: id, isDeleted: false },
    select: {
      id: true,
      title: true,
      eventDate: true,
      category: true,
      location: true,
      description: true,
      deadline: true,
      notificationLink: true,
      applyLink: true,
      publisher: true,
      journalId: true,
      journal: { select: { id: true, title: true } },
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
      isDeleted: true,
      deletedByType: true,
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

export async function createCallForPaper(formData: FormData) {
  const auth = await getActiveUser("Please log in to submit details.");
  if (auth.frozen) return { success: false, error: auth.message, message: auth.message };
  const user = auth.user;
  await enforceRateLimit({ namespace: "event:create", key: user.id, limit: 10, window: "10 m" });

  const title = readFormValue(formData, "title");
  const category = readFormValue(formData, "category");
  const eventDateInput = readOptionalFormValue(formData, "eventDate");
  const eventDate = eventDateInput ? new Date(eventDateInput) : null;
  const location = readFormValue(formData, "location");
  const description = readFormValue(formData, "description");
  assertRichTextWithinLimit(description, MAX_EVENT_DESCRIPTION, "Description");
  const deadlineInput = readOptionalFormValue(formData, "deadline");
  const deadline = deadlineInput ? new Date(deadlineInput) : null;
  const notificationLink = readFormValue(formData, "notificationLink");
  const applyLink = readFormValue(formData, "applyLink");
  const publisher = readOptionalFormValue(formData, "publisher");
  const journalId = readOptionalFormValue(formData, "journalId");
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
  if (journalId) {
    const journal = await prisma.journal.findFirst({ where: { id: journalId, isDeleted: false }, select: { id: true } });
    if (!journal) return { success: false, message: "Selected journal is no longer available." };
  }

  const event = await prisma.$transaction(async (tx) => {
    const newEvent = await tx.callForPaper.create({
      data: {
        title,
        category: category as "CONFERENCE" | "BOOK_CHAPTER" | "JOURNAL" | "WORKSHOP" | "SYMPOSIUM",
        eventDate,
        location,
        description,
        deadline,
        notificationLink: safeNotificationLink,
        applyLink: safeApplyLink,
        authorId: user.id,
        publisher,
        journalId,
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
        journal: { select: { id: true, title: true } },
        votes: { where: { userId: user.id }, select: { voteType: true } }, bookmarks: { where: { userId: user.id }, select: { id: true } },
      },
    });

    await tx.userActivity.create({
      data: {
        userId: user.id,
        action: "PUBLISHED",
        moduleType: "CALL_FOR_PAPER",
        entityId: newEvent.id,
        entityTitle: newEvent.title,
      },
    });

    await tx.user.update({
      where: { id: user.id },
      data: { callForPaperCount: { increment: 1 } },
    });

    return newEvent;
  });

  await notifyFollowersOfActivity({
    actorId: user.id,
    type: "content-published",
    targetType: "CallForPaper",
    targetId: event.id,
    title: `${user.email?.split("@")[0] || "Someone"} posted a new research event`,
    body: eventDate
      ? `"${title}" - ${eventDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`
      : title,
  });

  // Purge the cached research event pages: publish must be visible at once, not after the TTL.
  revalidateContent("CALL_FOR_PAPER", user.id);

  return { success: true, data: event };
}

export async function updateCallForPaper(formData: FormData, eventId: string) {
  // Frozen owners may edit (to correct content before appealing).
  const user = await requireCurrentUser("Log in to edit this event.");
  await enforceRateLimit({ namespace: "event:edit", key: user.id, limit: 20, window: "10 m" });

  const title = readFormValue(formData, "title");
  const category = readFormValue(formData, "category");
  const eventDateInput = readOptionalFormValue(formData, "eventDate");
  const eventDate = eventDateInput ? new Date(eventDateInput) : null;
  const location = readFormValue(formData, "location");
  const description = readFormValue(formData, "description");
  assertRichTextWithinLimit(description, MAX_EVENT_DESCRIPTION, "Description");
  const deadlineInput = readOptionalFormValue(formData, "deadline");
  const deadline = deadlineInput ? new Date(deadlineInput) : null;
  const notificationLink = readFormValue(formData, "notificationLink");
  const applyLink = readFormValue(formData, "applyLink");
  const publisher = readOptionalFormValue(formData, "publisher");
  const journalId = readOptionalFormValue(formData, "journalId");
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

  const event = await prisma.callForPaper.findUnique({
    where: { id: eventId },
    select: { authorId: true },
  });

  if (!event) {
    throw new Error("Event not found.");
  }
  if (!(await isAuthorizedOrAdmin(event.authorId, user.id))) {
    throw new Error("Not authorized to edit this event.");
  }
  if (journalId) {
    const journal = await prisma.journal.findFirst({ where: { id: journalId, isDeleted: false }, select: { id: true } });
    if (!journal) return { success: false, message: "Selected journal is no longer available." };
  }

  const updatedEvent = await prisma.callForPaper.update({
    where: { id: eventId },
    data: {
      title,
      category: category as "CONFERENCE" | "BOOK_CHAPTER" | "JOURNAL" | "WORKSHOP" | "SYMPOSIUM",
      eventDate,
      location,
      description,
      deadline,
      notificationLink: safeNotificationLink,
      applyLink: safeApplyLink,
      publisher,
      journalId,
      editedAt: new Date(),
    },
  });

  // Purge the cached research event pages: edit must be visible at once, not after the TTL.
  revalidateContent("CALL_FOR_PAPER", event.authorId);

  return { success: true, data: updatedEvent };
}

export async function deleteCallForPaper(eventId: string) {
  // Frozen owners may delete own content (read/edit/delete allowed, create blocked).
  const user = await requireCurrentUser("Log in to delete this event.");
  await enforceRateLimit({ namespace: "event:delete", key: user.id, limit: 20, window: "10 m" });

  const event = await prisma.callForPaper.findUnique({
    where: { id: eventId },
    select: { authorId: true, totalVotes: true, totalComments: true },
  });

  if (!event) {
    throw new Error("Event not found.");
  }

  const deletedByType = await resolvePostDeletePermission(
    user.id,
    event.authorId,
  );

  await prisma.$transaction(async (tx) => {
    await tx.callForPaper.update({
      where: { id: eventId },
      data: { isDeleted: true, deletedByType, deletedById: user.id },
    });

    await tx.user.update({
      where: { id: event.authorId },
      data: { callForPaperCount: { decrement: 1 } },
    });

    if (event.totalVotes !== 0) {
      await tx.user.update({
        where: { id: event.authorId },
        data: { reputation: { decrement: event.totalVotes } },
      });
    }

    // Hide this content's activity so a deleted event stops appearing in
    // anyone's activity feed at once (not after the cache TTL).
    await hideContentActivity(tx, "CALL_FOR_PAPER", eventId)

    // Delete every notification pointing at this event and its comments.
    await deleteAllNotificationsForContent(tx, "CALL_FOR_PAPER", eventId)
  });

  // Purge the cached research event pages: soft delete must be visible at once, not after the TTL.
  revalidateContent("CALL_FOR_PAPER", event.authorId);

  // Purge every bookmarker's Bookmarks tab so a soft-deleted event stops
  // inflating their bookmark count or showing a phantom "show more" arrow.
  await revalidateBookmarkersForDeletedContent("CALL_FOR_PAPER", eventId);

  return { success: true, data: { deletedId: eventId, isDeleted: true as const, deletedByType, totalComments: event.totalComments } };
}
