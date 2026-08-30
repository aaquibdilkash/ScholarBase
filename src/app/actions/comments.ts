/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { requireCurrentUser, isAuthorizedOrAdmin } from "@/lib/auth";
import prisma from "@/lib/db";
import { readFormValue } from "@/lib/form";
import { notifyMentionedUsers, notifyUserById } from "@/lib/notifications";
import type { CommentWithAuthorAndVotes, CommentEntityType } from "@/types/comments";
import {
  COMMENT_TYPE_TO_MODULE,
  createCommentTransaction,
  deleteCommentTransaction,
  ENTITY_CONFIG,
} from "@/lib/transactions";

// ============================================
// LAZY PAGINATION (Zero-Compute Reads)
// ============================================
// Shallow offset pagination for discussion threads. Neither action ever pulls
// an entire thread into memory: parents and replies are fetched in slices of
// PAGE_SIZE on demand by CommentSection / CommentThread respectively.
import { COMMENT_PAGE_SIZE } from "@/lib/constants";

function commentPageSelect(currentUserId: string | null) {
  return {
    id: true,
    content: true,
    createdAt: true,
    updatedAt: true,
    editedAt: true,
    parentId: true,
    authorId: true,
    // Soft-delete flags (RULE 4) — tombstoned comments render a placeholder
    isDeleted: true,
    isFrozen: true,
    deletedByType: true,
    // Materialized counters — no dynamic _count aggregation
    totalVotes: true,
    totalReplies: true,
    author: {
      select: { id: true, name: true, handle: true, avatarUrl: true },
    },
    // RULE 2: resolve the viewer's vote state directly in this query (N+1 fix)
    votes: currentUserId
      ? { where: { userId: currentUserId }, select: { voteType: true } }
      : false,
    mentions: true,
  };
}

export async function fetchParentComments(
  type: CommentEntityType,
  postId: string,
  skip: number,
  currentUserId: string | null = null,
): Promise<CommentWithAuthorAndVotes[]> {
  const moduleKey = COMMENT_TYPE_TO_MODULE[type];
  if (!moduleKey) throw new Error(`Invalid comment type: ${type}`);

  const config = ENTITY_CONFIG[moduleKey];
  const commentModel = config.comment as any;

  return (await commentModel.findMany({
    where: { parentId: null, isDeleted: false, [config.commentFk]: postId },
    select: commentPageSelect(currentUserId),
    // Must match the seed order (createdAt desc) used by every detail-page
    // loader so offset pagination continues from where the first page ended.
    orderBy: { createdAt: "desc" },
    skip,
    take: COMMENT_PAGE_SIZE,
  })) as CommentWithAuthorAndVotes[];
}

export async function fetchReplies(
  type: CommentEntityType,
  parentId: string,
  skip: number,
  currentUserId: string | null = null,
): Promise<CommentWithAuthorAndVotes[]> {
  const moduleKey = COMMENT_TYPE_TO_MODULE[type];
  if (!moduleKey) throw new Error(`Invalid comment type: ${type}`);

  const config = ENTITY_CONFIG[moduleKey];
  const commentModel = config.comment as any;

  return (await commentModel.findMany({
    where: { parentId, isDeleted: false },
    select: commentPageSelect(currentUserId),
    orderBy: { createdAt: "asc" },
    skip,
    take: COMMENT_PAGE_SIZE,
  })) as CommentWithAuthorAndVotes[];
}

async function getParentAuthorId(
  type: CommentEntityType,
  targetId: string,
  parentId?: string,
) {
  const moduleKey = COMMENT_TYPE_TO_MODULE[type];
  if (!moduleKey) throw new Error(`Invalid comment type: ${type}`);

  const config = ENTITY_CONFIG[moduleKey];
  const commentModel = config.comment as any;

  if (parentId) {
    const parentComment = await commentModel.findUnique({
      where: { id: parentId },
      select: { authorId: true },
    });
    return parentComment?.authorId;
  } else {
    const parentEntity = await (config.parent as any).findUnique({
      where: { id: targetId },
      select: { authorId: true },
    });
    return (parentEntity as any)?.authorId;
  }
}

export async function createComment(
  formData: FormData,
  targetId: string,
  type: CommentEntityType,
  parentId?: string,
) {
  const user = await requireCurrentUser(
    "Log in to join the academic discussion.",
  );

  const content = readFormValue(formData, "content");
  if (!content) return { success: false, error: "Content cannot be empty." };

  const moduleKey = COMMENT_TYPE_TO_MODULE[type];
  if (!moduleKey) {
    return { success: false, error: "Invalid comment type" };
  }

  const mentionsRaw = readFormValue(formData, "mentions");
  let mentions: { id: string; handle: string | null }[] | undefined;
  if (mentionsRaw) {
    try {
      mentions = JSON.parse(mentionsRaw);
      const validMentions =
        mentions?.filter((m): m is { id: string; handle: string } =>
          Boolean(m.handle),
        ) ?? [];
      if (validMentions.length > 0) {
        await notifyMentionedUsers({
          actorId: user.id,
          content,
          type: "mention",
          targetType: type,
          targetId,
          titleFactory: (handle) => `@${handle} was mentioned in a comment`,
          bodyFactory: () => content,
          mentions: validMentions,
        });
      }
    } catch {
      /* ignore invalid JSON */
    }
  }

  const createdComment = await createCommentTransaction(
    moduleKey,
    targetId,
    user.id,
    content,
    parentId,
    mentions,
  );

  const [actor, parentAuthorId] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: { name: true, handle: true, email: true },
    }),
    getParentAuthorId(type, targetId, parentId),
  ]);

  const actorName =
    actor?.name || actor?.handle || actor?.email?.split("@")[0] || "Someone";

  if (parentAuthorId && parentAuthorId !== user.id) {
    await notifyUserById({
      recipientId: parentAuthorId,
      actorId: user.id,
      type: parentId ? "reply-created" : "comment-created",
      targetType: type,
      targetId,
      title: parentId
        ? `${actorName} replied to your comment`
        : `${actorName} commented on your post`,
      body: content,
    });
  }

  return { success: true, data: createdComment };
}

export async function editComment(
  formData: FormData,
  commentId: string,
  type: CommentEntityType,
) {
  const user = await requireCurrentUser("Log in to edit this comment.");
  const content = readFormValue(formData, "content");
  if (!content) return { success: false, error: "Content cannot be empty." };

  const moduleKey = COMMENT_TYPE_TO_MODULE[type];
  if (!moduleKey) throw new Error("Invalid comment type");
  const commentModel = ENTITY_CONFIG[moduleKey].comment as any;

  const comment = await commentModel.findUnique({
    where: { id: commentId },
    select: { authorId: true },
  });

  if (!comment) {
    throw new Error("Comment not found.");
  }
  if (!(await isAuthorizedOrAdmin(comment.authorId, user.id))) {
    throw new Error("Not authorized.");
  }

  const updatedComment = await commentModel.update({
    where: { id: commentId },
    data: { content, editedAt: new Date() },
  });

  return { success: true, data: updatedComment };
}

export async function deleteComment(
  commentId: string,
  type: CommentEntityType,
) {
  const { id: userId } = await requireCurrentUser(
    "You must be logged in to delete comments.",
  );

  const moduleKey = COMMENT_TYPE_TO_MODULE[type];
  if (!moduleKey) {
    throw new Error("Invalid comment type");
  }

  const commentModel = ENTITY_CONFIG[moduleKey].comment as any;
  const comment = await commentModel.findUnique({
    where: { id: commentId },
    select: { parentId: true },
  });

  const result = await deleteCommentTransaction(moduleKey, commentId, userId);

  return {
    success: true,
    data: {
      id: commentId,
      parentId: comment?.parentId,
      wasTombstoned: result.wasTombstoned,
    },
  };
}
