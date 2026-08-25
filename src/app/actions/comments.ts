/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { requireCurrentUser, isAuthorizedOrAdmin } from "@/lib/auth";
import prisma from "@/lib/db";
import { readFormValue } from "@/lib/form";
import { notifyMentionedUsers, notifyUserById } from "@/lib/notifications";
import { CommentEntityType } from "@/types/comments";
import {
  COMMENT_TYPE_TO_MODULE,
  createCommentTransaction,
  deleteCommentTransaction,
  ENTITY_CONFIG,
} from "@/lib/transactions";

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
        notifyMentionedUsers({
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
    notifyUserById({
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
