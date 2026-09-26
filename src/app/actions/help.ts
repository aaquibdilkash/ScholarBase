"use server";

import type { HelpPostWithAuthor } from "@/types/cards";

import {
  loadContentPage,
  revalidateContent,
} from "@/lib/tri-split/modules/registry";

import { cache } from "react";

import prisma from "@/lib/db";
import { resolvePostDeletePermission } from "@/lib/deletion";
import { requireActiveUser, isAuthorizedOrAdmin } from "@/lib/auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import { notifyFollowersOfActivity } from "@/lib/notifications";
import { assertRichTextWithinLimit } from "@/lib/form";
import { COMMENT_PAGE_SIZE, MAX_HELP_POST_MESSAGE } from "@/lib/constants";
import { VISIBLE_PARENT_COMMENT_WHERE } from "@/lib/comment-visibility";

/**
 * Loads one page of help post rows for the
 * *current* viewer.
 *
 * Identity comes from the session, server-side — never from a client argument.
 * (This loader used to accept `userId` from the browser, so any caller could
 * read another user's vote / bookmark / follow state.)
 *
 * The cached viewer-agnostic batch plus the single-statement live overlay live
 * in `@/lib/tri-split/modules/registry`.
 */
export async function getHelpPosts(
  q?: string,
  limit = 10,
  cursor?: string,
) {
  return loadContentPage("HELP_POST", { query: q, pageSize: limit, cursor }) as Promise<
  HelpPostWithAuthor[]
>;
}

export const getHelpPost = cache(async (id: string, userId?: string) => {
  if (!id || typeof id !== "string") {
    throw new Error(`Invalid ID passed to getHelpPost: ${id}`);
  }

  // RULE 6: The query is already optimized. The server-side data mapping
  // has been removed. The client is now responsible for deriving state
  // like `isFollowing` and `userVote` from the raw `followers` and `votes` arrays.
  return prisma.helpPost.findUnique({
    where: { id, isDeleted: false },
    select: {
      id: true,
      title: true,
      subject: true,
      category: true,
      message: true,
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
      totalComments: true,
      votes: userId ? { where: { userId }, select: { voteType: true } } : false,
      bookmarks: userId ? { where: { userId }, select: { id: true } } : false,
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
        orderBy: { createdAt: "desc" },
      },
    },
  });
});

export async function createHelpPost(formData: FormData) {
  const user = await requireActiveUser(
    "You must be logged in to create a post.",
  );
  await enforceRateLimit({ namespace: "help:create", key: user.id, limit: 10, window: "10 m" });
  const title = formData.get("title") as string;
  const subject = formData.get("subject") as string;
  const category = formData.get("category") as string;
  const message = formData.get("message") as string;

  if (!title || !subject || !category || !message) {
    throw new Error("Please fill in all fields.");
  }
  assertRichTextWithinLimit(message, MAX_HELP_POST_MESSAGE, "Message");

  const post = await prisma.$transaction(async (tx) => {
    const newPost = await tx.helpPost.create({
      data: {
        title,
        subject,
        category,
        message,
        authorId: user.id,
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
        votes: { where: { userId: user.id }, select: { voteType: true } }, bookmarks: { where: { userId: user.id }, select: { id: true } },
      },
    });

    await tx.userActivity.create({
      data: {
        userId: user.id,
        action: "PUBLISHED",
        moduleType: "HELP_POST",
        entityId: newPost.id,
        entityTitle: newPost.title,
      },
    });

    await tx.user.update({
      where: { id: user.id },
      data: { helpPostCount: { increment: 1 }, reputation: { increment: 1 } },
    });

    return newPost;
  });

  // Fire-and-forget notification
  await notifyFollowersOfActivity({
    actorId: user.id,
    type: "content-published",
    targetType: "HelpPost",
    targetId: post.id,
    title: `${user.user_metadata?.name || user.email?.split("@")[0] || "Someone"} posted a help request`,
    body: post.title,
  });

  // Purge the cached help post pages: publish must be visible at once, not after the TTL.
  revalidateContent("HELP_POST");

  return { success: true, data: post };
}

export async function updateHelpPost(formData: FormData, helpPostId: string) {
  const user = await requireActiveUser(
    "You must be logged in to update a post.",
  );
  await enforceRateLimit({ namespace: "help:edit", key: user.id, limit: 20, window: "10 m" });

  const title = formData.get("title") as string;
  const subject = formData.get("subject") as string;
  const category = formData.get("category") as string;
  const message = formData.get("message") as string;

  if (!title || !subject || !category || !message) {
    throw new Error("Please fill in all fields.");
  }
  assertRichTextWithinLimit(message, MAX_HELP_POST_MESSAGE, "Message");

  const post = await prisma.helpPost.findUnique({
    where: { id: helpPostId },
    select: { authorId: true },
  });

  if (!post) {
    throw new Error("Help post not found.");
  }
  if (!(await isAuthorizedOrAdmin(post.authorId, user.id))) {
    throw new Error("Not authorized to edit this help post.");
  }

  const updatedPost = await prisma.helpPost.update({
    where: { id: helpPostId },
    data: { title, subject, category, message, editedAt: new Date() },
  });

  // Purge the cached help post pages: edit must be visible at once, not after the TTL.
  revalidateContent("HELP_POST");

  return { success: true, data: updatedPost };
}

export async function deleteHelpPost(helpPostId: string) {
  const user = await requireActiveUser("Log in to delete this help post.");
  await enforceRateLimit({ namespace: "help:delete", key: user.id, limit: 20, window: "10 m" });

  const post = await prisma.helpPost.findUnique({
    where: { id: helpPostId },
    select: { authorId: true, totalVotes: true },
  });

  if (!post) {
    throw new Error("Help post not found.");
  }
  const deletedByType = await resolvePostDeletePermission(
    user.id,
    post.authorId,
  );

  await prisma.$transaction(async (tx) => {
    await tx.helpPost.update({
      where: { id: helpPostId },
      data: { isDeleted: true, deletedByType, deletedById: user.id },
    });

     await tx.user.update({
       where: { id: post.authorId },
       data: { helpPostCount: { decrement: 1 }, reputation: { decrement: 1 } },
     });

     if (post.totalVotes !== 0) {
      await tx.user.update({
        where: { id: post.authorId },
        data: { reputation: { decrement: post.totalVotes } },
      });
    }
  });

  // Purge the cached help post pages: soft delete must be visible at once, not after the TTL.
  revalidateContent("HELP_POST");

  return { success: true, data: { deletedId: helpPostId } };
}
