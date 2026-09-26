"use server";

import type { ContributionWithAuthor } from "@/types/cards";

import {
  loadContentPage,
  revalidateContent,
} from "@/lib/tri-split/modules/registry";

import { cache } from "react";

import prisma from "@/lib/db";
import { resolvePostDeletePermission } from "@/lib/deletion";
import { requireActiveUser, requireCurrentUser, isAuthorizedOrAdmin } from "@/lib/auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import { readFormValue, readOptionalFormValue, assertRichTextWithinLimit } from "@/lib/form";
import {
  deleteCloudinaryAsset,
  promoteDraftCloudinaryAsset,
} from "@/lib/cloudinary";
import { notifyFollowersOfActivity } from "@/lib/notifications";
import { COMMENT_PAGE_SIZE, MAX_CONTRIBUTION_MESSAGE } from "@/lib/constants";
import { VISIBLE_PARENT_COMMENT_WHERE } from "@/lib/comment-visibility";

/**
 * Loads one page of contribution rows for the
 * *current* viewer.
 *
 * Identity comes from the session, server-side — never from a client argument.
 * (This loader used to accept `userId` from the browser, so any caller could
 * read another user's vote / bookmark / follow state.)
 *
 * The cached viewer-agnostic batch plus the single-statement live overlay live
 * in `@/lib/tri-split/modules/registry`.
 */
export async function getContributions(
  q?: string,
  limit = 10,
  cursor?: string,
) {
  return loadContentPage("CONTRIBUTION", { query: q, pageSize: limit, cursor }) as Promise<
  ContributionWithAuthor[]
>;
}

export const getContribution = cache(async (id: string, userId?: string) => {
  return prisma.contribution.findUnique({
    where: { id, isDeleted: false },
    select: {
      id: true,
      title: true,
      amount: true,
      message: true,
      screenshotUrl: true,
      status: true,
      rejectionReason: true,
      authorId: true,
      createdAt: true,
      updatedAt: true,
      editedAt: true,
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

export async function getContributionForEdit(id: string) {
  const currentUser = await requireCurrentUser(
    "You must be logged in to edit this contribution.",
  );

  const contribution = await prisma.contribution.findUnique({
    where: { id, isDeleted: false },
    select: {
      id: true,
      title: true,
      message: true,
      amount: true,
      upiId: true,
      paymentMethod: true,
      screenshotUrl: true,
      status: true,
      authorId: true,
    },
  });

  if (!contribution) return null;
  if (!(await isAuthorizedOrAdmin(contribution.authorId, currentUser.id))) return null;

  return contribution;
}

export async function createContribution(formData: FormData) {
  const user = await requireActiveUser(
    "Please log in to submit a contribution.",
  );
  await enforceRateLimit({ namespace: "contribution:create", key: user.id, limit: 10, window: "10 m" });

  const title = readFormValue(formData, "title");
  const message = readFormValue(formData, "message");
  assertRichTextWithinLimit(message, MAX_CONTRIBUTION_MESSAGE, "Message");
  const amountStr = readOptionalFormValue(formData, "amount");
  const upiId = readOptionalFormValue(formData, "upiId");
  const paymentMethod = readOptionalFormValue(formData, "paymentMethod");
  const screenshotUrl = readOptionalFormValue(formData, "screenshotUrl");
  const amount = amountStr ? parseFloat(amountStr) : null;

  if (!title || !message) throw new Error("Title and message are required.");
  if (amount !== null && (isNaN(amount) || amount < 1))
    throw new Error("Amount must be at least ₹1.");

  const publishedScreenshotUrl = screenshotUrl
    ? await promoteDraftCloudinaryAsset(screenshotUrl, user.id, "contribution")
    : null;
  if (screenshotUrl && !publishedScreenshotUrl) {
    throw new Error("Invalid contribution image.");
  }

  const contribution = await prisma.$transaction(async (tx) => {
    const newContribution = await tx.contribution.create({
      data: {
        title,
        message,
        amount,
        upiId,
        paymentMethod,
        screenshotUrl: publishedScreenshotUrl,
        status: "PENDING",
        authorId: user.id,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            handle: true,
            avatarUrl: true, institutionVerifiedAt: true,
            followers: { where: { followerId: user.id }, select: { followerId: true } },
          },
        },
        votes: { where: { userId: user.id }, select: { voteType: true } }, bookmarks: { where: { userId: user.id }, select: { id: true } },
      },
    });

    await tx.userActivity.create({
      data: {
        userId: user.id,
        action: "PUBLISHED",
        moduleType: "CONTRIBUTION",
        entityId: newContribution.id,
        entityTitle: newContribution.title.substring(0, 100),
      },
    });

    await tx.user.update({
      where: { id: user.id },
      data: { contributionCount: { increment: 1 }, reputation: { increment: 1 } },
    });

    return newContribution;
  });

  await notifyFollowersOfActivity({
    actorId: user.id,
    type: "content-published",
    targetType: "Contribution",
    targetId: contribution.id,
    title: `${user.user_metadata?.name || user.email?.split("@")[0] || "Someone"} made a contribution`,
    body: `${title}${amount ? ` (₹${amount})` : ""}`,
  });

  // Purge the cached contribution pages: publish must be visible at once, not after the TTL.
  revalidateContent("CONTRIBUTION");

  return { success: true, data: contribution };
}

export async function updateContribution(
  contributionId: string,
  formData: FormData,
) {
  const user = await requireActiveUser("Log in to edit this contribution.");
  await enforceRateLimit({ namespace: "contribution:edit", key: user.id, limit: 20, window: "10 m" });

  const existingContribution = await prisma.contribution.findUnique({
    where: { id: contributionId },
    select: { authorId: true, status: true, screenshotUrl: true },
  });

  if (!existingContribution) throw new Error("Contribution not found.");
  if (!(await isAuthorizedOrAdmin(existingContribution.authorId, user.id)))
    throw new Error("Not authorized.");

  const title = readFormValue(formData, "title");
  const message = readFormValue(formData, "message");
  assertRichTextWithinLimit(message, MAX_CONTRIBUTION_MESSAGE, "Message");

  // If approved, only allow editing title and message
  if (existingContribution.status === "APPROVED") {
    const updatedContribution = await prisma.contribution.update({
      where: { id: contributionId },
      data: { title, message, editedAt: new Date() },
    });
    return { success: true, data: updatedContribution };
  }

  // Otherwise, allow editing all fields
  const amountStr = readOptionalFormValue(formData, "amount");
  const upiId = readOptionalFormValue(formData, "upiId");
  const paymentMethod = readOptionalFormValue(formData, "paymentMethod");
  const screenshotUrl = readOptionalFormValue(formData, "screenshotUrl");
  const amount = amountStr ? parseFloat(amountStr) : null;

  const oldScreenshot = existingContribution.screenshotUrl;
  const newScreenshot = screenshotUrl
    ? screenshotUrl === oldScreenshot
      ? screenshotUrl
      : await promoteDraftCloudinaryAsset(
          screenshotUrl,
          user.id,
          "contribution",
        )
    : null;

  if (screenshotUrl && !newScreenshot) {
    throw new Error("Invalid contribution image.");
  }

  // If it was rejected, move it back to pending on edit
  const status =
    existingContribution.status === "REJECTED" ? "PENDING" : undefined;

  const updatedContribution = await prisma.contribution.update({
    where: { id: contributionId },
    data: {
      title,
      message,
      amount,
      upiId,
      paymentMethod,
      screenshotUrl: newScreenshot,
      editedAt: new Date(),
      ...(status && { status }),
    },
  });

  if (oldScreenshot && oldScreenshot !== newScreenshot) {
    await deleteCloudinaryAsset(oldScreenshot);
  }

  // Purge the cached contribution pages: edit must be visible at once, not after the TTL.
  revalidateContent("CONTRIBUTION");

  return { success: true, data: updatedContribution };
}

export async function deleteContribution(contributionId: string) {
  const user = await requireActiveUser("Log in to delete this contribution.");
  await enforceRateLimit({ namespace: "contribution:delete", key: user.id, limit: 20, window: "10 m" });

  const contribution = await prisma.contribution.findUnique({
    where: { id: contributionId },
    select: { authorId: true, totalVotes: true },
  });

  if (!contribution) throw new Error("Contribution not found.");
  const deletedByType = await resolvePostDeletePermission(
    user.id,
    contribution.authorId,
  );

  await prisma.$transaction(async (tx) => {
    await tx.contribution.update({
      where: { id: contributionId },
      data: { isDeleted: true, deletedByType, deletedById: user.id },
    });

     await tx.user.update({
       where: { id: contribution.authorId },
       data: { contributionCount: { decrement: 1 }, reputation: { decrement: 1 } },
     });

     // Reverse the vote-derived reputation so RECOVER can re-grant it exactly
    // (same invariant as every other content type's delete flow).
    if (contribution.totalVotes !== 0) {
      await tx.user.update({
        where: { id: contribution.authorId },
        data: { reputation: { decrement: contribution.totalVotes } },
      });
    }
  });

  // The screenshot is intentionally NOT deleted from Cloudinary on soft delete.
  // Purge the cached contribution pages: soft delete must be visible at once, not after the TTL.
  revalidateContent("CONTRIBUTION");

  return { success: true, data: { deletedId: contributionId } };
}

// Note: Admin-specific actions like approve/reject are in `admin.ts`
// and are assumed to be refactored separately.
