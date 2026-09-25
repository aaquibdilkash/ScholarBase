"use server";

import { cache } from "react";

import prisma from "@/lib/db";
import { resolvePostDeletePermission } from "@/lib/deletion";
import { getCurrentUser, requireCurrentUser, requireActiveUser, getActiveUser, isAuthorizedOrAdmin } from "@/lib/auth";
import { readFormValue } from "@/lib/form";
import { checkRateLimit, RATE_LIMIT_ERROR } from "@/lib/rate-limit";

import { COMMENT_PAGE_SIZE } from "@/lib/constants";
import { VISIBLE_PARENT_COMMENT_WHERE } from "@/lib/comment-visibility";
import {
  handleVoteTransaction,
  createCommentTransaction,
  deleteCommentTransaction,
} from "@/lib/transactions";
import {
  getCachedPublicFeed,
  getSocialPostLiveOverlay,
  loadDynamicFeedPage,
  normalizeFeedPageSize,
  revalidatePublicFeed,
} from "@/lib/feed-cache";
import { stitchSocialPostLiveState } from "@/lib/feed-stitch";
import type { SocialPostFeedItem } from "@/types/feed";
import { VoteType, DeletedByType } from "@prisma/client";

import {
  notifyFollowersOfActivity,
  notifyMentionedUsers,
  resolveMentionedUsers,
} from "@/lib/notifications";
import {
  deleteCloudinaryAsset,
  promoteDraftCloudinaryAsset,
} from "@/lib/cloudinary";
import { queueNotification } from "@/lib/qstash";
import type { SocialPostWithAuthor } from "@/types/cards";
import type { MentionUser } from "@/components/interactions/CommentThread";

// Reusable include for the materialized-counter post shape used by the
// client query cache (author + votes relationship; scalars like
// totalVotes/totalComments are returned automatically by `include`).
const socialPostInclude = {
  author: {
    select: {
      id: true,
      name: true,
      handle: true,
      avatarUrl: true, institutionVerifiedAt: true,
    },
  },
  votes: {
    select: { userId: true, voteType: true },
  },
  bookmarks: {
    select: { id: true },
  },
} as const;

// Helper to cast a Prisma SocialPost result to SocialPostWithAuthor.
// Prisma returns mentions as JsonValue; we cast it to MentionUser[] | null.
function castPost(post: {
  id: string;
  content: string;
  imageUrl: string | null;
  imageUrls: string[];
  authorId: string;
  createdAt: Date;
  updatedAt: Date;
  editedAt: Date | null;
  isFrozen: boolean;
  hasActiveAppeal: boolean;
  totalVotes: number;
  totalBookmarks: number;
  totalComments: number;
  trendingScore: number;
  isDeleted: boolean;
  deletedByType: DeletedByType | null;
  deletedById: string | null;
  reportCount: number;
  mentions?: unknown;
  author: {
    id: string;
    name: string | null;
    handle: string | null;
    avatarUrl: string | null;
  };
  votes: { userId: string; voteType: VoteType }[] | false;
  bookmarks: { id: string }[] | false;
}): SocialPostWithAuthor {
  return {
    ...post,
    mentions: Array.isArray(post.mentions)
      ? (post.mentions as MentionUser[])
      : null,
  };
}

/**
 * Loads one page of the Research Feed for the *current* viewer.
 *
 * Identity comes from the session, server-side — never from a client argument.
 * (The previous `getFeed` accepted a `userId` from the browser, so any caller
 * could read another user's vote/bookmark/follow state.)
 *
 *  - Global feed        -> cached, viewer-agnostic batch (`getCachedPublicFeed`)
 *  - following / search -> dynamic, never cached
 *  - viewer state       -> one live indexed statement, stitched onto the batch
 */
export async function fetchFeedPage(
  tab?: string,
  query?: string,
  pageSize?: number,
  cursor?: string,
): Promise<SocialPostFeedItem[]> {
  const user = await getCurrentUser();
  const viewerId = user?.id;
  // Clamped because the page size is part of the cache key.
  const limit = normalizeFeedPageSize(pageSize);

  const isFollowingTab = tab === "following";
  const hasQuery = Boolean(query && query.trim().length > 0);

  const posts =
    isFollowingTab || hasQuery
      ? await loadDynamicFeedPage({
          viewerId,
          followingOnly: isFollowingTab,
          query,
          limit,
          cursor,
        })
      : await getCachedPublicFeed(limit, cursor);

  if (posts.length === 0) return [];

  // The live half of the split: viewer state + mutable counters, resolved in
  // ONE statement for exactly these rows.
  const overlay = viewerId
    ? await getSocialPostLiveOverlay(
        viewerId,
        posts.map((post) => post.id),
        Array.from(new Set(posts.map((post) => post.authorId))),
      )
    : null;

  return stitchSocialPostLiveState(posts, overlay);
}

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
      mentions: true,
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
      // RULE 6: Use materialized counters and filtered selects
      totalVotes: true,
      totalBookmarks: true,
      isFrozen: true,
      hasActiveAppeal: true,
      totalComments: true,
      votes: userId ? { where: { userId }, select: { voteType: true } } : false,
      bookmarks: userId ? { where: { userId }, select: { id: true } } : false,
      // LAZY PAGINATION: ship only the first page of parent comments.
      // Replies are fetched on demand by CommentThread via fetchReplies().
      comments: {
        where: VISIBLE_PARENT_COMMENT_WHERE,
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
        take: COMMENT_PAGE_SIZE + 1,
      },
    },
  });
});

export async function createSocialPost(formData: FormData) {
  const auth = await getActiveUser("You must be logged in to post.");
  if (auth.frozen) {
    return { success: false, message: auth.message };
  }
  const authUser = auth.user;

  try {
    const rateLimit = await checkRateLimit({
    namespace: "post:create",
    key: authUser.id,
    limit: 10,
    window: "10 m",
  });

    if (!rateLimit.allowed) {
      return { success: false, error: RATE_LIMIT_ERROR };
    }

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

  const mentions = await resolveMentionedUsers(content);
  let publishedImageUrl: string | null = null;
  if (imageUrl) {
    publishedImageUrl = await promoteDraftCloudinaryAsset(
      imageUrl,
      authUser.id,
      "social",
    );
    if (!publishedImageUrl) throw new Error("Invalid post image.");
  }

  const post = await prisma.$transaction(async (tx) => {
    const newPost = await tx.socialPost.create({
      data: {
        content,
        imageUrl: publishedImageUrl || undefined,
        imageUrls: publishedImageUrl ? [publishedImageUrl] : [],
        authorId: authUser.id,
        mentions: mentions ?? undefined,
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
      data: { socialPostCount: { increment: 1 }, reputation: { increment: 1 } },
    });

    return newPost;
  });

  await Promise.all([
    notifyFollowersOfActivity({
      actorId: authUser.id,
      type: "content-published",
      targetType: "post",
      targetId: post.id,
      title: `${user.name || user.email?.split("@")[0] || "Someone"} posted an update`,
      body: content.slice(0, 120),
    }),
    notifyMentionedUsers({
      actorId: authUser.id,
      content,
      type: "post-mention",
      targetType: "post",
      targetId: post.id,
      titleFactory: (handle) => `@${handle} mentioned you in a post`,
      bodyFactory: () => content.slice(0, 120),
      mentions,
    }),
  ]);

  // Read-your-own-writes: purge the cached public feed so the new post is
  // visible to everyone on the very next request.
  revalidatePublicFeed();

  return { success: true, data: castPost(post) };
  } catch (error) {
    console.error("[CreateSocialPostAction Error]:", error);
    return {
      success: false,
      message: "Unable to publish post. Please check the image and try again.",
    };
  }
}

export async function updateSocialPost(formData: FormData, postId: string) {
  const auth = await getActiveUser("Log in to edit this post.");
  if (auth.frozen) {
    return { success: false, message: "Your account is frozen. Editing is disabled." };
  }
  const user = auth.user;

  try {
    const rateLimit = await checkRateLimit({
    namespace: "post:edit",
    key: user.id,
    limit: 20,
    window: "10 m",
  });

  if (!rateLimit.allowed) {
    return { success: false, message: RATE_LIMIT_ERROR };
  }

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

  const mentions = await resolveMentionedUsers(content);

  // Persist the edit first so the DB is the source of truth. Then delete the
  // old image from Cloudinary only after the update has succeeded — so if the
  // user changes their mind before saving, the original image is preserved,
  // and if the update fails, the old image is never deleted.
  const oldImage = post.imageUrl;
  const newImage = imageUrl
    ? imageUrl === oldImage
      ? imageUrl
      : await promoteDraftCloudinaryAsset(imageUrl, user.id, "social")
    : null;

  if (imageUrl && !newImage) {
    throw new Error("Invalid post image.");
  }

  const updatedPost = await prisma.socialPost.update({
    where: { id: postId },
    data: {
      content,
      imageUrl: newImage,
      imageUrls: newImage ? [newImage] : [],
      editedAt: new Date(),
      mentions: mentions ?? undefined,
    },
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
    await deleteCloudinaryAsset(oldImage);
  }

  // The edited body/mentions/editedAt are part of the cached public payload.
  revalidatePublicFeed();

  return { success: true, data: castPost(updatedPost) };
  } catch (error) {
    console.error("[UpdateSocialPostAction Error]:", error);
    return {
      success: false,
      message: "Unable to update post. Please check the image and try again.",
    };
  }
}

export async function getPostEditData(id: string) {
  const user = await requireCurrentUser("Log in to edit this post.");

  const post = await prisma.socialPost.findUnique({
    where: { id },
    select: {
      content: true,
      imageUrl: true,
      authorId: true,
      mentions: true,
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
    mentions: post.mentions,
  };
}

export async function deleteSocialPost(postId: string) {
  const user = await requireActiveUser("Log in to delete this post.");

  const rateLimit = await checkRateLimit({
    namespace: "post:delete",
    key: user.id,
    limit: 20,
    window: "10 m",
  });

  if (!rateLimit.allowed) {
    return { success: false, error: RATE_LIMIT_ERROR };
  }

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
      data: { socialPostCount: { decrement: 1 }, reputation: { decrement: 1 } },
    });

    if (post.totalVotes !== 0) {
      await tx.user.update({
        where: { id: post.authorId },
        data: { reputation: { decrement: post.totalVotes } },
      });
    }
  });

  // Soft delete (RULE 4) must disappear from the cached public feed at once.
  revalidatePublicFeed();

  return { success: true, data: { id: postId } };
}

export async function voteOnSocialPost(postId: string, voteType: VoteType) {
  const auth = await getActiveUser("You must be logged in to vote.");
  if (auth.frozen) {
    return { success: false, error: auth.message };
  }
  const user = auth.user;

  const rateLimit = await checkRateLimit({
    namespace: "post-vote",
    key: user.id,
    limit: 120,
    window: "1 m",
  });

  if (!rateLimit.allowed) {
    return { success: false, error: RATE_LIMIT_ERROR };
  }
  const { notification } = await handleVoteTransaction("SOCIAL_POST", postId, user.id, voteType);
  if (notification) {
    void queueNotification({
      mode: "TARGETED",
      type: "NEW_VOTE",
      actorId: user.id,
      recipientId: notification.recipientId,
      targetType: notification.targetType,
      targetId: notification.targetId,
      title: "New Upvote",
      body: notification.body,
    }).catch((error) => console.error("QStash vote notification error:", error));
  }
}

export async function createSocialPostComment(
  postId: string,
  content: string,
  parentId?: string,
) {
  const user = await requireActiveUser("You must be logged in to comment.");
  const rateLimit = await checkRateLimit({
    namespace: "post-comment",
    key: user.id,
    limit: 20,
    window: "1 m",
  });

  if (!rateLimit.allowed) {
    return { success: false, error: RATE_LIMIT_ERROR };
  }
  await createCommentTransaction(
    "SOCIAL_POST",
    postId,
    user.id,
    content,
    parentId,
  );
}

export async function deleteSocialPostComment(commentId: string) {
  const user = await requireActiveUser(
    "You must be logged in to delete comments.",
  );
  const rateLimit = await checkRateLimit({
    namespace: "post-comment:delete",
    key: user.id,
    limit: 20,
    window: "1 m",
  });

  if (!rateLimit.allowed) {
    return { success: false, error: RATE_LIMIT_ERROR };
  }
  const { parentId } = await deleteCommentTransaction(
    "SOCIAL_POST",
    commentId,
    user.id,
  );
  return { success: true, parentId };
}
