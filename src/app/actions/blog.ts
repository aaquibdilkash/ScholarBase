"use server";

import { getCurrentUser } from "@/lib/auth";

import { cache } from "react";

import prisma from "@/lib/db";
import { resolvePostDeletePermission } from "@/lib/deletion";
import { getActiveUser, requireCurrentUser, isAuthorizedOrAdmin } from "@/lib/auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import { readFormValue, slugify, assertRichTextWithinLimit } from "@/lib/form";
import {
  notifyFollowersOfActivity,
  notifyMentionedUsers,
} from "@/lib/notifications";
import { COMMENT_PAGE_SIZE, MAX_ARTICLE_CONTENT } from "@/lib/constants";
import { VISIBLE_PARENT_COMMENT_WHERE } from "@/lib/comment-visibility";
import { loadContentPage, revalidateContent } from "@/lib/tri-split/modules/registry";
import { revalidateBookmarkersForDeletedContent } from "@/lib/tri-split/modules/profile-tab";
import { hideContentActivity } from "@/lib/activity";
import { promoteContentImages, findRemovedImagePaths } from "@/lib/content-images";
import { repairLegacyInlineImages } from "@/lib/article-content";
import { extractCoverImagePath, deleteContentImagePaths } from "@/lib/supabase-storage";
import type { ArticleWithAuthor } from "@/types/cards";

/**
 * Loads one page of articles for the *current* viewer.
 *
 * Identity comes from the session, server-side — never from a client argument.
 * (This loader used to accept `userId` from the browser, so any caller could
 * read another user's vote / bookmark / follow state.)
 *
 * The cached batch + single-statement live overlay are configured under the
 * `ARTICLE` key in `@/lib/tri-split/modules/registry`, like every listing page.
 */
export async function getArticles(
  q?: string,
  limit = 10,
  cursor?: string,
) {
  return loadContentPage("ARTICLE", {
    query: q,
    pageSize: limit,
    cursor,
  }) as Promise<ArticleWithAuthor[]>;
}

export const getArticle = cache(async (slugOrId: string, userId?: string) => {
  // RULE 6: The query is already optimized. All server-side data mapping
  // has been removed. The client is now responsible for deriving state
  // like `isFollowing` and `userVote` from the raw `followers` and `votes` arrays.
  const article = await prisma.article.findFirst({
    where: {
      isDeleted: false,
      OR: [{ slug: slugOrId }, { id: slugOrId }],
    },
    select: {
      id: true,
      slug: true,
      title: true,
      excerpt: true,
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

  if (!article) return article;

  // Legacy rows stored inline images as escaped text; repair them on read so
  // the image renders instead of the URL.
  return {
    ...article,
    content: repairLegacyInlineImages(article.content),
  };
});

export async function createArticle(formData: FormData) {
  const auth = await getActiveUser("Log in to publish an article.");
  if (auth.frozen) return { success: false, error: auth.message, message: auth.message };
  const user = auth.user;
  const writeLimit = await enforceRateLimit({ namespace: "article:create", key: user.id, limit: 10, window: "10 m" });
  if (!writeLimit.allowed) return { success: false as const, error: writeLimit.error };

  const title = readFormValue(formData, "title");
  const content = readFormValue(formData, "content");
  const excerpt = readFormValue(formData, "excerpt");
  const coverImageUrl = formData.get("coverImageUrl") as string | null;

  if (!title || !content) {
    throw new Error("Title and content are required.");
  }

  // Validate the plain-text length (never the raw HTML) and store the full,
  // un-truncated HTML payload.
  assertRichTextWithinLimit(content, MAX_ARTICLE_CONTENT, "Article content");

  // Promote draft images (cover + inline) to published before creating the article.
  const promoted = await promoteContentImages({
    coverKind: "article-cover",
    inlineKind: "article-inline",
    imageUrl: coverImageUrl || undefined,
    html: content,
    userId: user.id,
  });
  if (!promoted.ok) {
    return { success: false, error: promoted.error, message: promoted.error };
  }
  const { coverUrl, publishedHtml } = promoted;

  const baseSlug = slugify(title) || "article";
  let slug = baseSlug;
  let suffix = 1;

  while (await prisma.article.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${suffix++}`;
  }

  const article = await prisma.$transaction(async (tx) => {
    const newArticle = await tx.article.create({
      data: {
        title,
        content: publishedHtml,
        excerpt,
        imageUrl: coverUrl,
        slug,
        authorId: user.id,
        published: true,
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
        moduleType: "ARTICLE",
        entityId: newArticle.id,
        entityTitle: newArticle.title.substring(0, 100),
      },
    });

    await tx.user.update({
      where: { id: user.id },
      data: { articleCount: { increment: 1 } },
    });

    return newArticle;
  });

  await Promise.all([
    notifyFollowersOfActivity({
      actorId: user.id,
      type: "content-published",
      targetType: "Article",
      targetId: article.id,
      title: `${user.user_metadata?.name || user.email?.split("@")[0] || "Someone"} published a new blog`,
      body: article.title,
    }),
    notifyMentionedUsers({
      actorId: user.id,
      content: `${title}\n${publishedHtml}`,
      type: "mention",
      targetType: "Article",
      targetId: article.id,
      titleFactory: (handle) => `@${handle} was mentioned in an article`,
      bodyFactory: () => article.title,
    }),
  ]);

  // Read-your-own-writes: purge the cached article pages so the new post is
  // visible to everyone on the very next request.
  revalidateContent("ARTICLE", user.id);

  return { success: true, data: article };
}

export async function updateArticle(formData: FormData, articleId: string) {
  // Frozen owners may edit (to correct content before appealing).
  const user = await requireCurrentUser("Log in to edit this article.");
  const writeLimit = await enforceRateLimit({ namespace: "article:edit", key: user.id, limit: 20, window: "10 m" });
  if (!writeLimit.allowed) return { success: false as const, error: writeLimit.error };

  const title = readFormValue(formData, "title");
  const content = readFormValue(formData, "content");
  const excerpt = readFormValue(formData, "excerpt");
  const coverImageUrl = formData.get("coverImageUrl") as string | null;

  if (!title || !content) {
    throw new Error("Title and content are required.");
  }

  // Validate the plain-text length (never the raw HTML) and store the full,
  // un-truncated HTML payload.
  assertRichTextWithinLimit(content, MAX_ARTICLE_CONTENT, "Article content");

  const article = await prisma.article.findUnique({
    where: { id: articleId },
    select: { authorId: true, slug: true, imageUrl: true, content: true },
  });

  if (!article) {
    throw new Error("Article not found.");
  }
  if (!(await isAuthorizedOrAdmin(article.authorId, user.id))) {
    throw new Error("Not authorized to edit this article.");
  }

  // Promote draft images (cover + inline) to published before updating.
  const promoted = await promoteContentImages({
    coverKind: "article-cover",
    inlineKind: "article-inline",
    imageUrl: coverImageUrl || undefined,
    html: content,
    userId: user.id,
  });
  if (!promoted.ok) {
    return { success: false, error: promoted.error, message: promoted.error };
  }
  const { coverUrl, publishedHtml } = promoted;

  // Work out which images this edit removes, but do NOT delete them yet.
  //
  // The feed deletes a replaced post image as soon as it is replaced
  // (`deleteContentImagePaths` on save). This does the same for the blog and
  // extends it to INLINE body images, which the feed never had: every image
  // that was in the stored body and is no longer in the new body is collected.
  //
  // Every path here comes from the article's OWN stored content (or its own
  // stored cover), never from the submitted form, so this cannot delete
  // somebody else's object.
  const removedPaths = findRemovedImagePaths(article.content, publishedHtml);
  const oldCoverPath = extractCoverImagePath(article.imageUrl);
  const newCoverPath = extractCoverImagePath(coverUrl);
  if (oldCoverPath && oldCoverPath !== newCoverPath) {
    removedPaths.push(oldCoverPath);
  }

  const baseSlug = slugify(title) || "article";
  let nextSlug = baseSlug;
  let suffix = 1;

  if (article.slug !== nextSlug) {
    while (await prisma.article.findUnique({ where: { slug: nextSlug } })) {
      nextSlug = `${baseSlug}-${suffix++}`;
    }
  }

  const updatedArticle = await prisma.article.update({
    where: { id: articleId },
    data: {
      title,
      content: publishedHtml,
      excerpt,
      imageUrl: coverUrl,
      slug: nextSlug,
      editedAt: new Date(),
    },
  });

  // Persist the edit FIRST so the database is the source of truth, then
  // collect the images the edit replaced. Deleting before the write would
  // leave the article pointing at objects that are already gone if the write
  // failed — the same ordering the feed uses for a replaced post image.
  if (removedPaths.length > 0) {
    await deleteContentImagePaths(removedPaths);
  }

  // The edited title/excerpt/slug are part of the cached public payload.
  revalidateContent("ARTICLE", article.authorId);

  return { success: true, data: updatedArticle };
}

export async function deleteArticle(articleId: string) {
  // Frozen owners may delete own content (read/edit/delete allowed, create blocked).
  const user = await requireCurrentUser("Log in to delete this article.");
  const writeLimit = await enforceRateLimit({ namespace: "article:delete", key: user.id, limit: 20, window: "10 m" });
  if (!writeLimit.allowed) return { success: false as const, error: writeLimit.error };

  const article = await prisma.article.findUnique({
    where: { id: articleId },
    select: { authorId: true, totalVotes: true, totalComments: true },
  });

  if (!article) {
    throw new Error("Article not found.");
  }
  const deletedByType = await resolvePostDeletePermission(
    user.id,
    article.authorId,
  );

  await prisma.$transaction(async (tx) => {
    await tx.article.update({
      where: { id: articleId },
      data: { isDeleted: true, deletedByType, deletedById: user.id },
    });

     await tx.user.update({
       where: { id: article.authorId },
       data: { articleCount: { decrement: 1 } },
     });

     if (article.totalVotes !== 0) {
      await tx.user.update({
        where: { id: article.authorId },
        data: { reputation: { decrement: article.totalVotes } },
      });
    }

    // Hide this content's activity so a deleted article stops appearing in
    // anyone's activity feed at once (not after the cache TTL).
    await hideContentActivity(tx, "ARTICLE", articleId)
  });

  // Soft delete (RULE 4) must disappear from the cached public pages at once.
  revalidateContent("ARTICLE", article.authorId);

  // Purge every bookmarker's Bookmarks tab so a soft-deleted article stops
  // inflating their bookmark count or showing a phantom "show more" arrow.
  await revalidateBookmarkersForDeletedContent("ARTICLE", articleId);

  return { success: true, data: { deletedId: articleId, isDeleted: true as const, deletedByType, totalComments: article.totalComments } };
}

export async function getLatestArticles(count: number) {
  // Identity comes from the session, server-side — never from a client
  // argument. This used to accept `userId` and filter the author's
  // `followers` relation by it, so any caller could read another user's
  // follow relationships.
  const user = await getCurrentUser();
  const userId = user?.id;

  return prisma.article.findMany({
    where: { isDeleted: false },
    take: count,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      slug: true,
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
    },
  });
}
