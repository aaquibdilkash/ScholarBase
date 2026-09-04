"use server";

import { cache } from "react";

import { Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import { resolvePostDeletePermission } from "@/lib/deletion";
import { requireActiveUser, isAuthorizedOrAdmin } from "@/lib/auth";
import { notifyFollowersOfActivity } from "@/lib/notifications";
import { COMMENT_PAGE_SIZE } from "@/lib/constants";

export async function getHelpPosts(
  q?: string,
  userId?: string,
  limit = 10,
  cursor?: string,
) {
  const where: Prisma.HelpPostWhereInput = {
    isDeleted: false,
    ...(q && {
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { subject: { contains: q, mode: "insensitive" } },
        { message: { contains: q, mode: "insensitive" } },
      ],
    }),
  };

  // RULE 6: The query is already optimized with filtered selects and materialized counters.
  // The `.map()` transformation has been removed to stop doing server-side computation.
  // The client is now responsible for deriving `isFollowing` and `userVote`.
  return prisma.helpPost.findMany({
    where,
    orderBy: {
      createdAt: "desc",
    },
    take: limit,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      title: true,
      subject: true,
      category: true,
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
      totalVotes: true,
      isFrozen: true,
      hasActiveAppeal: true,
      totalComments: true,
      votes: userId ? { where: { userId }, select: { voteType: true } } : false,
    },
  });
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
      },
    },
  });
});

export async function createHelpPost(formData: FormData) {
  const user = await requireActiveUser(
    "You must be logged in to create a post.",
  );
  const title = formData.get("title") as string;
  const subject = formData.get("subject") as string;
  const category = formData.get("category") as string;
  const message = formData.get("message") as string;

  if (!title || !subject || !category || !message) {
    throw new Error("Please fill in all fields.");
  }

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
            avatarUrl: true,
            followers: {
              where: { followerId: user.id },
              select: { followerId: true },
            },
          },
        },
        votes: {
          where: { userId: user.id },
          select: { voteType: true },
        },
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

  return { success: true, data: post };
}

export async function updateHelpPost(formData: FormData, helpPostId: string) {
  const user = await requireActiveUser(
    "You must be logged in to update a post.",
  );

  const title = formData.get("title") as string;
  const subject = formData.get("subject") as string;
  const category = formData.get("category") as string;
  const message = formData.get("message") as string;

  if (!title || !subject || !category || !message) {
    throw new Error("Please fill in all fields.");
  }

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

  return { success: true, data: updatedPost };
}

export async function deleteHelpPost(helpPostId: string) {
  const user = await requireActiveUser("Log in to delete this help post.");

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

  return { success: true, data: { deletedId: helpPostId } };
}
