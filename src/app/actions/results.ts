"use server";

import type { ResultWithAuthor } from "@/types/cards";

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
import { COMMENT_PAGE_SIZE, MAX_RESULT_DESCRIPTION } from "@/lib/constants";
import { VISIBLE_PARENT_COMMENT_WHERE } from "@/lib/comment-visibility";
import {
  parseResultKind,
  parseResultOutcomeType,
  type ResultKindValue,
} from "@/lib/results/entry-types";

type ResolvedPostFields =
  | { kind: ResultKindValue; type: string }
  | { error: string };

type ResolvedExamDeadline = { deadline: Date | null } | { error: string };

/**
 * Resolves the kind/type pair for a create or edit.
 *
 * A result notification carries the chosen outcome type. An exam notification
 * is always stored as `EXAM`, whatever the client sent. On edit, an omitted
 * field keeps its stored value; switching the kind is an explicit choice, so an
 * omitted type is only carried over when the kind did not change.
 */
function resolvePostFields(
  formData: FormData,
  existing?: { kind: ResultKindValue; type: string },
): ResolvedPostFields {
  const submittedKind = readOptionalFormValue(formData, "kind");
  const kind =
    submittedKind === null
      ? (existing?.kind ?? "RESULT_NOTIFICATION")
      : parseResultKind(submittedKind);
  if (!kind) return { error: "Choose a valid post kind." };

  if (kind === "EXAM_NOTIFICATION") return { kind, type: "EXAM" };

  const submittedType = readOptionalFormValue(formData, "type");
  const type =
    submittedType === null
      ? (existing?.kind === "RESULT_NOTIFICATION" ? existing.type : null)
      : parseResultOutcomeType(submittedType);
  if (!type) return { error: "Choose a valid outcome type." };

  return { kind, type };
}

/**
 * Resolves the last date to apply for an exam notification.
 *
 * Exam notifications must carry a deadline: the publish notification (and the
 * card) say "Apply by <date>", and an exam notice without a date is the exact
 * gap this field closes. A result notification has no deadline and stores NULL.
 */
function resolveExamDeadline(
  formData: FormData,
  kind: ResultKindValue,
): ResolvedExamDeadline {
  if (kind !== "EXAM_NOTIFICATION") return { deadline: null };
  const raw = readFormValue(formData, "deadline");
  if (!raw) {
    return { error: "Last Date to Apply is required for an exam notification." };
  }
  const deadline = new Date(raw);
  if (Number.isNaN(deadline.getTime())) {
    return { error: "Invalid last date to apply." };
  }
  return { deadline };
}

/**
 * Loads one page of result rows for the
 * *current* viewer.
 *
 * Identity comes from the session, server-side — never from a client argument.
 * (This loader used to accept `userId` from the browser, so any caller could
 * read another user's vote / bookmark / follow state.)
 *
 * The cached viewer-agnostic batch plus the single-statement live overlay live
 * in `@/lib/tri-split/modules/registry`.
 */
export async function getResults(
  q?: string,
  limit = 10,
  cursor?: string,
) {
  return loadContentPage("RESULT", { query: q, pageSize: limit, cursor }) as Promise<
  ResultWithAuthor[]
>;
}

export const getResult = cache(async (id: string, userId?: string) => {
  return prisma.examsAndResults.findUnique({
    where: { id, isDeleted: false },
    select: {
      id: true,
      title: true,
      description: true,
      kind: true,
      type: true,
      category: true,
      conductingBody: true,
      session: true,
      deadline: true,
      notificationLink: true,
      checkOrApplyLink: true,
      createdAt: true,
      updatedAt: true,
      editedAt: true,
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

export async function createResult(formData: FormData) {
  const auth = await getActiveUser("Please log in to submit details.");
  if (auth.frozen) return { success: false, error: auth.message, message: auth.message };
  const user = auth.user;
  const writeLimit = await enforceRateLimit({ namespace: "result:create", key: user.id, limit: 10, window: "10 m" });
  if (!writeLimit.allowed) return { success: false as const, error: writeLimit.error };

  const title = readFormValue(formData, "title");
  const description = readFormValue(formData, "description");
  assertRichTextWithinLimit(description, MAX_RESULT_DESCRIPTION, "Description");
  const fields = resolvePostFields(formData);
  if ("error" in fields) return { success: false, message: fields.error };
  const { kind, type } = fields;
  const resolvedDeadline = resolveExamDeadline(formData, kind);
  if ("error" in resolvedDeadline) {
    return { success: false, message: resolvedDeadline.error };
  }
  const { deadline } = resolvedDeadline;
  const category = readOptionalFormValue(formData, "category");
  const conductingBody = readOptionalFormValue(formData, "conductingBody");
  const session = readOptionalFormValue(formData, "session");
  const notificationLink = readOptionalFormValue(formData, "notificationLink");
  const checkOrApplyLink = readOptionalFormValue(formData, "checkOrApplyLink");
  let safeNotificationLink: string | null;
  let safeCheckOrApplyLink: string | null;
  try {
    safeNotificationLink = validateExternalUrl(notificationLink, "Notification link");
    safeCheckOrApplyLink = validateExternalUrl(
      checkOrApplyLink,
      kind === "EXAM_NOTIFICATION" ? "Apply link" : "Result link",
    );
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : "Invalid URL." };
  }

  const result = await prisma.$transaction(async (tx) => {
    const newResult = await tx.examsAndResults.create({
      data: {
        title,
        description,
        kind,
        type,
        category,
        conductingBody,
        session,
        deadline,
        notificationLink: safeNotificationLink,
        checkOrApplyLink: safeCheckOrApplyLink,
        authorId: user.id,
      },
      include: { author: { select: { id: true, name: true, handle: true, avatarUrl: true, institutionVerifiedAt: true, followers: { where: { followerId: user.id }, select: { followerId: true } } } }, votes: { where: { userId: user.id }, select: { voteType: true } }, bookmarks: { where: { userId: user.id }, select: { id: true } } }
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
    title: `${user.email?.split("@")[0] || "Someone"} posted a new ${
      kind === "EXAM_NOTIFICATION" ? "exam notification" : "result"
    }`,
    body: `${title}${category ? ` (${category})` : ""}${conductingBody ? ` - ${conductingBody}` : ""}${
      kind === "EXAM_NOTIFICATION" && deadline
        ? ` - Apply by ${deadline.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
        : ""
    }`,
  });

  // Purge the cached result pages: publish must be visible at once, not after the TTL.
  revalidateContent("RESULT", user.id);

  return { success: true, data: result };
}

export async function updateResult(formData: FormData, resultId: string) {
  // Frozen owners may edit (to correct content before appealing).
  const user = await requireCurrentUser("Log in to edit this result.");
  const writeLimit = await enforceRateLimit({ namespace: "result:edit", key: user.id, limit: 20, window: "10 m" });
  if (!writeLimit.allowed) return { success: false as const, error: writeLimit.error };

  const title = readFormValue(formData, "title");
  const description = readFormValue(formData, "description");
  assertRichTextWithinLimit(description, MAX_RESULT_DESCRIPTION, "Description");
  const category = readOptionalFormValue(formData, "category");
  const conductingBody = readOptionalFormValue(formData, "conductingBody");
  const session = readOptionalFormValue(formData, "session");
  const notificationLink = readOptionalFormValue(formData, "notificationLink");
  const checkOrApplyLink = readOptionalFormValue(formData, "checkOrApplyLink");

  const result = await prisma.examsAndResults.findUnique({
    where: { id: resultId },
    select: { authorId: true, kind: true, type: true },
  });

  if (!result) {
    throw new Error("Result not found.");
  }
  if (!(await isAuthorizedOrAdmin(result.authorId, user.id))) {
    throw new Error("Not authorized to edit this result.");
  }

  const fields = resolvePostFields(formData, {
    kind: result.kind,
    type: result.type,
  });
  if ("error" in fields) return { success: false, message: fields.error };
  const { kind, type } = fields;
  const resolvedDeadline = resolveExamDeadline(formData, kind);
  if ("error" in resolvedDeadline) {
    return { success: false, message: resolvedDeadline.error };
  }
  const { deadline } = resolvedDeadline;

  let safeNotificationLink: string | null;
  let safeCheckOrApplyLink: string | null;
  try {
    safeNotificationLink = validateExternalUrl(notificationLink, "Notification link");
    safeCheckOrApplyLink = validateExternalUrl(
      checkOrApplyLink,
      kind === "EXAM_NOTIFICATION" ? "Apply link" : "Result link",
    );
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : "Invalid URL." };
  }

  const updatedResult = await prisma.examsAndResults.update({
    where: { id: resultId },
    data: {
      title,
      description,
      kind,
      type,
      category,
      conductingBody,
      session,
      deadline,
      notificationLink: safeNotificationLink,
      checkOrApplyLink: safeCheckOrApplyLink,
      editedAt: new Date(),
    },
  });

  // Purge the cached result pages: edit must be visible at once, not after the TTL.
  revalidateContent("RESULT", result.authorId);

  return { success: true, data: updatedResult };
}

export async function deleteResult(resultId: string) {
  // Frozen owners may delete own content (read/edit/delete allowed, create blocked).
  const user = await requireCurrentUser("Log in to delete this result.");
  const writeLimit = await enforceRateLimit({ namespace: "result:delete", key: user.id, limit: 20, window: "10 m" });
  if (!writeLimit.allowed) return { success: false as const, error: writeLimit.error };

  const result = await prisma.examsAndResults.findUnique({
    where: { id: resultId },
    select: { authorId: true, totalVotes: true, totalComments: true },
  });

  if (!result) {
    throw new Error("Result not found.");
  }
  const deletedByType = await resolvePostDeletePermission(
    user.id,
    result.authorId,
  );

  await prisma.$transaction(async (tx) => {
    await tx.examsAndResults.update({
      where: { id: resultId },
      data: { isDeleted: true, deletedByType, deletedById: user.id },
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

    // Hide this content's activity so a deleted result stops appearing in
    // anyone's activity feed at once (not after the cache TTL).
    await hideContentActivity(tx, "RESULT", resultId)

    // Delete every notification pointing at this result and its comments.
    await deleteAllNotificationsForContent(tx, "RESULT", resultId)
  });

  // Purge the cached result pages: soft delete must be visible at once, not after the TTL.
  revalidateContent("RESULT", result.authorId);

  // Purge every bookmarker's Bookmarks tab so a soft-deleted post stops
  // inflating their bookmark count or showing a phantom "show more" arrow.
  await revalidateBookmarkersForDeletedContent("RESULT", resultId);

  return { success: true, data: { deletedId: resultId, isDeleted: true as const, deletedByType, totalComments: result.totalComments } };
}
