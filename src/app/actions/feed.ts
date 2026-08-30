"use server";

import { cache } from "react";

import prisma from "@/lib/db";
import { resolvePostDeletePermission } from "@/lib/deletion";
import { requireCurrentUser, isAuthorizedOrAdmin } from "@/lib/auth";
import { readFormValue } from "@/lib/form";

import { COMMENT_PAGE_SIZE } from "@/lib/constants";
import {
  handleVoteTransaction,
  createCommentTransaction,
  deleteCommentTransaction,
} from "@/lib/transactions";
import { VoteType } from "@prisma/client";

import {
  notifyFollowersOfActivity,
  notifyMentionedUsers,
} from "@/lib/notifications";
import { deleteFromCloudinary } from "@/app/actions/cloudinary";
// Reusable include for the materialized-counter post shape used by the
// client query cache (author + votes relationship; scalars like
// totalVotes/totalComments are returned automatically by `include`).
const socialPostInclude = {
  author: {
    select: {
      id: true,
      name: true,
      handle: true,
      avatarUrl: true,
    },
  },
  votes: {
    select: { userId: true, voteType: true },
  },
} as const;

const getFeed = async (
  userId?: string,
  tab?: string,
  q?: string,
  limit = 10,
  cursor?: string,
) => {
  const isFollowingTab = tab === "following";
  const hasQuery = Boolean(q && q.trim().length > 0);
  let followingIds: string[] = [];

  if (isFollowingTab && userId) {
    const following = await prisma.follows.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    });
    followingIds = following.map((f) => f.followingId);
  }

  const posts = await prisma.socialPost.findMany({
    where: {
      isDeleted: false, // RULE 3: Filter out soft-deleted posts
      ...(isFollowingTab && { authorId: { in: followingIds } }),
      ...(hasQuery && {
        OR: [
          { content: { contains: q, mode: "insensitive" } },
          { author: { name: { contains: q, mode: "insensitive" } } },
          { author: { handle: { contains: q, mode: "insensitive" } } },
        ],
      }),
    },
    select: {
      id: true,
      content: true,
      imageUrl: true,
      createdAt: true,
      updatedAt: true,
      editedAt: true,
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
      // RULE 6: Use materialized counters
      totalVotes: true,
      isFrozen: true,
      hasActiveAppeal: true,
      totalComments: true,
      // RULE 6: Filtered select for user's vote
      votes: userId ? { where: { userId }, select: { voteType: true } } : false,
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
  });

  return posts;
};

// Re-assign getFeed to the new implementation
export { getFeed };

export const getPost = cache(async (id: string, userId?: string) => {
  return prisma.socialPost.findUnique({
    where: {
      id,
      isDeleted: false, // RULE 3: Do not fetch soft-deleted posts
    },
    select: {
      id: true,
      content: true,
      imageUrl: true,
      createdAt: true,
      updatedAt: true,
      editedAt: true,
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
      // RULE 6: Use materialized counters and filtered selects
      totalVotes: true,
      isFrozen: true,
      hasActiveAppeal: true,
      totalComments: true,
      votes: userId ? { where: { userId }, select: { voteType: true } } : false,
      // LAZY PAGINATION: ship only the first page of parent comments.
      // Replies are fetched on demand by CommentThread via fetchReplies().
      comments: {
        where: { parentId: null, isDeleted: false },
        select: {
          id: true,
          content: true,
          createdAt: true,
          updatedAt: true,
          editedAt: true,
          parentId: true,
          authorId: true,
          isDeleted: true,
          isFrozen: true,
          hasActiveAppeal: true,
          deletedByType: true,
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
        orderBy: { createdAt: "desc" },
        take: COMMENT_PAGE_SIZE + 1,
      },
    },
  });
});

export async function createSocialPost(formData: FormData) {
  const authUser = await requireCurrentUser("You must be logged in to post.");

  const [content, user] = await Promise.all([
    readFormValue(formData, "content"),
    prisma.user.findUnique({
      where: { id: authUser.id },
      select: { name: true, email: true },
    }),
  ]);

  const imageUrl = formData.get("imageUrl") as string | null;

  if (!content) {
    throw new Error("Content cannot be empty.");
  }
  if (!user) {
    throw new Error("User not found in database.");
  }

  const post = await prisma.$transaction(async (tx) => {
    const newPost = await tx.socialPost.create({
      data: {
        content,
        imageUrl: imageUrl || undefined,
        authorId: authUser.id,
      },
      include: socialPostInclude,
    });

    await tx.userActivity.create({
      data: {
        userId: authUser.id,
        action: "PUBLISHED",
        moduleType: "SOCIAL_POST",
        entityId: newPost.id,
        entityTitle: content.substring(0, 100),
      },
    });

    await tx.user.update({
      where: { id: authUser.id },
      data: { socialPostCount: { increment: 1 } },
    });

    return newPost;
  });

  await Promise.all([
    await notifyFollowersOfActivity({
      actorId: authUser.id,
      type: "content-published",
      targetType: "post",
      targetId: post.id,
      title: `${user.name || user.email?.split("@")[0] || "Someone"} posted an update`,
      body: content.slice(0, 120),
    }),
    await notifyMentionedUsers({
      actorId: authUser.id,
      content,
      type: "mention",
      targetType: "post",
      targetId: post.id,
      titleFactory: (handle) => `@${handle} was mentioned in a post`,
      bodyFactory: () => content.slice(0, 120),
    }),
  ]);

  return { success: true, data: post };
}

export async function updateSocialPost(formData: FormData, postId: string) {
  const user = await requireCurrentUser("Log in to edit this post.");

  const content = readFormValue(formData, "content");
  if (!content) return { success: false, message: "Content cannot be empty." };

  const imageUrl = formData.get("imageUrl") as string | null;

  const post = await prisma.socialPost.findUnique({
    where: { id: postId },
    select: { authorId: true, imageUrl: true },
  });

  if (!post) return { success: false, message: "Post not found." };
  if (!(await isAuthorizedOrAdmin(post.authorId, user.id))) {
    throw new Error("Not authorized to edit this post.");
  }

  // Persist the edit first so the DB is the source of truth. Then delete the
  // old image from Cloudinary only after the update has succeeded — so if the
  // user changes their mind before saving, the original image is preserved,
  // and if the update fails, the old image is never deleted.
  const oldImage = post.imageUrl;
  const newImage = imageUrl || null;

  const updatedPost = await prisma.socialPost.update({
    where: { id: postId },
    data: { content, imageUrl: newImage || undefined, editedAt: new Date() },
    include: {
      ...socialPostInclude,
      author: {
        ...socialPostInclude.author,
        select: {
          ...socialPostInclude.author.select,
          followers: {
            where: { followerId: user.id },
            select: { followerId: true },
          },
        },
      },
    },
  });

  if (oldImage && oldImage !== newImage) {
    await deleteFromCloudinary(oldImage);
  }

  return { success: true, data: updatedPost };
}

export async function getPostEditData(id: string) {
  const user = await requireCurrentUser("Log in to edit this post.");

  const post = await prisma.socialPost.findUnique({
    where: { id },
    select: {
      content: true,
      imageUrl: true,
      authorId: true,
    },
  });

  if (!post) {
    throw new Error("Post not found");
  }

  if (post.authorId !== user.id) {
    throw new Error("You are not authorized to edit this post.");
  }

  return {
    content: post.content,
    imageUrl: post.imageUrl,
  };
}

export async function deleteSocialPost(postId: string) {
  const user = await requireCurrentUser("Log in to delete this post.");

  const post = await prisma.socialPost.findUnique({
    where: { id: postId },
    select: { authorId: true, totalVotes: true },
  });

  if (!post) return;
  const deletedByType = await resolvePostDeletePermission(
    user.id,
    post.authorId,
  );

  await prisma.$transaction(async (tx) => {
    await tx.socialPost.update({
      where: { id: postId },
      data: { isDeleted: true, deletedByType, deletedById: user.id },
    });

    await tx.user.update({
      where: { id: post.authorId },
      data: { socialPostCount: { decrement: 1 } },
    });

    if (post.totalVotes !== 0) {
      await tx.user.update({
        where: { id: post.authorId },
        data: { reputation: { decrement: post.totalVotes } },
      });
    }
  });

  return { success: true, data: { id: postId } };
}

export async function voteOnSocialPost(postId: string, voteType: VoteType) {
  const user = await requireCurrentUser("You must be logged in to vote.");
  await handleVoteTransaction("SOCIAL_POST", postId, user.id, voteType);
}

export async function createSocialPostComment(
  postId: string,
  content: string,
  parentId?: string,
) {
  const user = await requireCurrentUser("You must be logged in to comment.");
  await createCommentTransaction(
    "SOCIAL_POST",
    postId,
    user.id,
    content,
    parentId,
  );
}

export async function deleteSocialPostComment(commentId: string) {
  const user = await requireCurrentUser(
    "You must be logged in to delete comments.",
  );
  const { parentId } = await deleteCommentTransaction(
    "SOCIAL_POST",
    commentId,
    user.id,
  );
  return { success: true, parentId };
}
