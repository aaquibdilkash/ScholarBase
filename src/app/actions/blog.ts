'use server'

import prisma from '@/lib/db'
import { requireCurrentUser, isAuthorizedOrAdmin } from '@/lib/auth'
import { readFormValue, slugify } from '@/lib/form'
import { notifyFollowersOfActivity, notifyMentionedUsers } from '@/lib/notifications'
import { countVotesForTarget, reverseReputationForContent, reverseContentCommentVoteReputation }  from '@/app/actions/interactions'
import type { ArticleWithAuthor } from '@/types/cards'

export async function getArticles(q?: string, userId?: string, limit = 20, cursor?: string) {
    return prisma.article.findMany({
    where: q
      ? {
        OR: [
          {
            title: {
              contains: q,
              mode: "insensitive",
            },
          },
          {
            author: {
              name: {
                contains: q,
                mode: "insensitive",
              },
            },
          },
        ],
      }
      : {},
    orderBy: { createdAt: "desc" },
    take: limit,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
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
      votes: {
        select: {
          userId: true,
          voteType: true,
        },
      },
      _count: {
        select: {
          votes: true,
          comments: true,
        },
      },
    },
  });
}

export async function getArticle(slug: string, userId?: string) {
  return prisma.article.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      title: true,
      excerpt: true,
      content: true,
      createdAt: true,
      updatedAt: true,
      authorId: true,
      author: {
        select: {
          id: true,
          name: true,
          handle: true,
          avatarUrl: true,
          followers: userId
            ? {
              where: { followerId: userId },
              select: { followerId: true },
            }
            : false,
        },
      },
      votes: { select: { userId: true, voteType: true } },
      comments: {
        where: { parentId: null },
        select: {
          id: true,
          content: true,
          createdAt: true,
          updatedAt: true,
          parentId: true,
          author: {
            select: {
              id: true,
              name: true,
              handle: true,
              avatarUrl: true,
            },
          },
          votes: { select: { userId: true, voteType: true } },
          mentions: true,
          replies: {
            select: {
              id: true,
              content: true,
              createdAt: true,
              updatedAt: true,
              parentId: true,
              author: {
                select: { id: true, name: true, avatarUrl: true },
              },
              votes: { select: { userId: true, voteType: true } },
              mentions: true,
              _count: { select: { votes: true } },
            },
            orderBy: { createdAt: "asc" },
          },
          _count: { select: { votes: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      _count: {
        select: { votes: true, comments: true },
      },
    },
  });
}

export async function createArticle(formData: FormData) {
  const user = await requireCurrentUser('Log in to publish an article.')

  const title = readFormValue(formData, 'title')
  const content = readFormValue(formData, 'content')
  const excerpt = readFormValue(formData, 'excerpt')
  const baseSlug = slugify(title) || 'article'
  let slug = baseSlug
  let suffix = 1

  while (await prisma.article.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${suffix}`
    suffix += 1
  }

    const article = await prisma.article.create({
    data: {
      title,
      content,
      excerpt,
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
          avatarUrl: true,
          followers: user.id ? { where: { followerId: user.id }, select: { followerId: true } } : false,
        },
      },
      votes: { select: { userId: true, voteType: true } },
      _count: { select: { votes: true, comments: true } },
    },
  })

  await Promise.all([
    notifyFollowersOfActivity({
      actorId: user.id,
      type: 'article-published',
      targetType: 'article',
      targetId: slug,
      title: `${user.user_metadata?.name || user.email?.split('@')[0] || 'Someone'} published a new article`,
      body: title,
    }),
    notifyMentionedUsers({
      actorId: user.id,
      content: `${title}
${content}`,
      type: 'mention',
      targetType: 'article',
      targetId: slug,
      titleFactory: (handle) => `@${handle} was mentioned in an article`,
      bodyFactory: () => title,
    }),
  ])

  return { success: true, data: article }
}

export async function createArticleSafe(formData: FormData): Promise<{ success: boolean; data?: ArticleWithAuthor; error?: string }> {
    try {
        return await createArticle(formData);
    } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        return { success: false, error: error.message || 'Failed to create article' };
    }
}

export async function updateArticle(
  formData: FormData,
  articleId: string,
) {
  const user = await requireCurrentUser('Log in to edit this article.')

  const title = readFormValue(formData, 'title')
  const content = readFormValue(formData, 'content')
  const excerpt = readFormValue(formData, 'excerpt')

  const article = await prisma.article.findUnique({
    where: { id: articleId },
    select: { authorId: true, slug: true },
  })

  if (!article) {
	  throw new Error('Article not found.')
  }
  if (!await isAuthorizedOrAdmin(article.authorId, user.id)) {
    throw new Error('Not authorized to edit this article.')
  }

  const baseSlug = slugify(title) || 'article'
  let nextSlug = baseSlug
  let suffix = 1

  const currentSlug = article.slug
  while (
    nextSlug !== currentSlug &&
    (await prisma.article.findUnique({ where: { slug: nextSlug } }))
  ) {
    nextSlug = `${baseSlug}-${suffix}`
    suffix += 1
  }

  const updatedArticle = await prisma.article.update({
    where: { id: articleId },
    data: {
      title,
      content,
      excerpt,
      slug: nextSlug,
    },
    include: {
        author: {
            select: {
                id: true,
                name: true,
                handle: true,
                avatarUrl: true,
                followers: user.id ? { where: { followerId: user.id }, select: { followerId: true } } : false,
            },
        },
        votes: { select: { userId: true, voteType: true } },
        _count: { select: { votes: true, comments: true } },
    }
  })

  return { success: true, data: updatedArticle }
}

export async function updateArticleSafe(formData: FormData, articleId: string): Promise<{ success: boolean; data?: ArticleWithAuthor; error?: string }> {
    try {
        return await updateArticle(formData, articleId);
    } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        return { success: false, error: error.message || 'Failed to update article' };
    }
}

export async function deleteArticle(articleId: string) {
  const user = await requireCurrentUser('Log in to delete this article.')

  const article = await prisma.article.findUnique({
    where: { id: articleId },
    select: { authorId: true },
  })

  if (!article) {
	  throw new Error('Article not found.')
  }
  if (!await isAuthorizedOrAdmin(article.authorId, user.id)) {
    throw new Error('Not authorized to delete this article.')
  }

  const voteCounts = await countVotesForTarget(prisma.articleVote, 'articleId', articleId)
  await reverseReputationForContent(article.authorId, voteCounts)
  await reverseContentCommentVoteReputation('article', articleId)

  await prisma.article.delete({ where: { id: articleId } })

  return { success: true, data: { deletedId: articleId } }
}

export async function deleteArticleSafe(articleId: string): Promise<{ success: boolean; data?: { deletedId: string }; error?: string }> {
    try {
        return await deleteArticle(articleId);
    } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        return { success: false, error: error.message || 'Failed to delete article' };
    }
}

export async function getLatestArticles(count: number, userId?: string) {
    return prisma.article.findMany({
      take: count,
      orderBy: { createdAt: "desc" },
      include: {
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
      votes: {
        select: {
          userId: true,
          voteType: true,
        },
      },
      _count: {
        select: {
          comments: true,
        },
      },
    },
  });
}
