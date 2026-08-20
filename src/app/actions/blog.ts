'use server'

import { Prisma } from '@prisma/client'
import prisma from '@/lib/db'
import { requireCurrentUser, isAuthorizedOrAdmin } from '@/lib/auth'
import { readFormValue, slugify } from '@/lib/form'
import { notifyFollowersOfActivity, notifyMentionedUsers } from '@/lib/notifications'

export async function getArticles(q?: string, userId?: string, limit = 20, cursor?: string) {
    const where: Prisma.ArticleWhereInput = {
        isDeleted: false,
        ...(q && {
            OR: [
                { title: { contains: q, mode: 'insensitive' } },
                { author: { name: { contains: q, mode: 'insensitive' } } },
            ],
        })
    };

    // RULE 6: The query is already optimized. The `.map()` transformation has been
    // removed to stop doing server-side computation. The client is now responsible
    // for deriving `isFollowing` and `userVote`.
    return prisma.article.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: {
            id: true,
            title: true,
            slug: true,
            excerpt: true,
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
                    followers: userId ? { where: { followerId: userId }, select: { followerId: true } } : false,
                },
            },
            totalVotes: true,
            totalComments: true,
            votes: userId ? { where: { userId }, select: { voteType: true } } : false,
        },
    });
}

export async function getArticle(slug: string, userId?: string) {
    // RULE 6: The query is already optimized. All server-side data mapping
    // has been removed. The client is now responsible for deriving state
    // like `isFollowing` and `userVote` from the raw `followers` and `votes` arrays.
    return prisma.article.findUnique({
        where: { slug, isDeleted: false },
        select: {
            id: true,
            slug: true,
            title: true,
            excerpt: true,
            content: true,
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
                    followers: userId ? { where: { followerId: userId }, select: { followerId: true } } : false,
                },
            },
            totalVotes: true,
            totalComments: true,
            votes: userId ? { where: { userId }, select: { voteType: true } } : false,
            comments: {
                where: { parentId: null },
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    content: true,
                    createdAt: true,
                    updatedAt: true,
            editedAt: true,
                    author: {
                        select: { id: true, name: true, handle: true, avatarUrl: true },
                    },
                    totalVotes: true,
                    totalReplies: true,
                    votes: userId ? { where: { userId }, select: { voteType: true } } : false,
                    replies: {
                        orderBy: { createdAt: 'asc' },
                        select: {
                            id: true,
                            content: true,
                            createdAt: true,
                            updatedAt: true,
            editedAt: true,
                            author: {
                                select: { id: true, name: true, handle: true, avatarUrl: true },
                            },
                            totalVotes: true,
                            votes: userId ? { where: { userId }, select: { voteType: true } } : false,
                        },
                    },
                },
            },
        },
    });
}

export async function createArticle(formData: FormData) {
    const user = await requireCurrentUser('Log in to publish an article.')

    const title = readFormValue(formData, 'title')
    const content = readFormValue(formData, 'content')
    const excerpt = readFormValue(formData, 'excerpt')

    if (!title || !content) {
        throw new Error('Title and content are required.');
    }

    const baseSlug = slugify(title) || 'article'
    let slug = baseSlug
    let suffix = 1

    while (await prisma.article.findUnique({ where: { slug } })) {
        slug = `${baseSlug}-${suffix++}`
    }

    const article = await prisma.$transaction(async (tx) => {
        const newArticle = await tx.article.create({
            data: {
                title,
                content,
                excerpt,
                slug,
                authorId: user.id,
                published: true,
            },
        });

        await tx.userActivity.create({
            data: {
                userId: user.id,
                action: 'PUBLISHED',
                 moduleType: 'ARTICLE',
                entityId: newArticle.id,
                entityTitle: newArticle.title.substring(0, 100),
            }
        });
        
        return newArticle;
    });

    await Promise.all([
        notifyFollowersOfActivity({
            actorId: user.id,
            type: 'article-published',
            targetType: 'Article',
            targetId: article.id,
            title: `${user.user_metadata?.name || user.email?.split('@')[0] || 'Someone'} published a new article`,
            body: article.title,
        }),
        notifyMentionedUsers({
            actorId: user.id,
            content: `${title}\n${content}`,
            type: 'mention',
            targetType: 'Article',
            targetId: article.id,
            titleFactory: (handle) => `@${handle} was mentioned in an article`,
            bodyFactory: () => article.title,
        }),
    ]);

    return { success: true, data: article }
}

export async function updateArticle(formData: FormData, articleId: string) {
    const user = await requireCurrentUser('Log in to edit this article.')

    const title = readFormValue(formData, 'title')
    const content = readFormValue(formData, 'content')
    const excerpt = readFormValue(formData, 'excerpt')

    if (!title || !content) {
        throw new Error('Title and content are required.');
    }

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
    
    if (article.slug !== nextSlug) {
        while (await prisma.article.findUnique({ where: { slug: nextSlug } })) {
            nextSlug = `${baseSlug}-${suffix++}`
        }
    }

    const updatedArticle = await prisma.article.update({
        where: { id: articleId },
        data: {
            title,
            content,
            excerpt,
            slug: nextSlug,
            editedAt: new Date(),
        },
    })

    return { success: true, data: updatedArticle }
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

    await prisma.article.update({
        where: { id: articleId },
        data: { isDeleted: true },
    })

    return { success: true, data: { deletedId: articleId } }
}

export async function getLatestArticles(count: number, userId?: string) {
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
                    avatarUrl: true,
                    followers: userId ? { where: { followerId: userId }, select: { followerId: true } } : false,
                },
            },
            totalVotes: true,
            totalComments: true,
            votes: userId ? { where: { userId }, select: { voteType: true } } : false,
        },
    });
}
