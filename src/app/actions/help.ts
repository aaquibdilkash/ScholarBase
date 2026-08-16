'use server'

import { Prisma } from '@prisma/client'
import prisma from '@/lib/db'
import { requireCurrentUser, isAuthorizedOrAdmin } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { notifyFollowersOfActivity } from '@/lib/notifications'
import { countVotesForTarget, reverseReputationForContent, reverseContentCommentVoteReputation } from '@/app/actions/interactions'

export async function getHelpPosts(q?: string, userId?: string, limit = 20, cursor?: string) {
    const where = q
        ? {
            OR: [
                { title: { contains: q, mode: Prisma.QueryMode.insensitive } },
                { subject: { contains: q, mode: Prisma.QueryMode.insensitive } },
                { message: { contains: q, mode: Prisma.QueryMode.insensitive } },
            ],
        }
        : {};

    return prisma.helpPost.findMany({
        where,
        orderBy: {
            createdAt: 'desc',
        },
        take: limit,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        include: {
            author: {
                include: {
                    followers: userId
                        ? {
                            where: { followerId: userId },
                            select: { followerId: true },
                        }
                        : false,
                },
            },
            votes: {
                select: { userId: true, voteType: true },
            },
            _count: {
                select: { votes: true, comments: true },
            },
        },
    })
}

export async function getHelpPost(id: string, userId?: string) {
    if (!id || typeof id !== 'string') {
        throw new Error(`Invalid ID passed to getHelpPost: ${id}`);
    }

    return prisma.helpPost.findUnique({
        where: { id },
        select: {
            id: true,
            title: true,
            subject: true,
            category: true,
            message: true,
            createdAt: true,
            updatedAt: true,
            authorId: true,
            author: {
                select: {
                    id: true,
                    name: true,
                    handle: true,
                    avatarUrl: true,
                    followers: {
                        where: { followerId: userId },
                        select: { followerId: true },
                    },
                },
            },
            votes: {
                select: { userId: true, voteType: true },
            },
            _count: {
                select: { votes: true, comments: true },
            },
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
                                select: {
                                    id: true,
                                    name: true,
                                    handle: true,
                                    avatarUrl: true,
                                },
                            },
                            votes: { select: { userId: true, voteType: true } },
                            mentions: true,
                            _count: { select: { votes: true } },
                        },
                        orderBy: { createdAt: "asc" },
                    },
                    _count: { select: { votes: true } },
                },
                orderBy: {
                    createdAt: 'desc'
                }
            }
        },
    })
}

export async function createHelpPost(formData: FormData) {
    const user = await requireCurrentUser()
    const title = formData.get('title') as string
    const subject = formData.get('subject') as string
    const category = formData.get('category') as string
    const message = formData.get('message') as string

    if (!title || !subject || !category || !message) {
        throw new Error('Please fill in all fields.')
    }

    const post = await prisma.helpPost.create({
        data: {
            title,
            subject,
            category,
            message,
            authorId: user.id,
        },
    })

    await notifyFollowersOfActivity({
        actorId: user.id,
        type: 'help-post-published',
        targetType: 'help',
        targetId: post.id,
        title: `${user.email?.split('@')[0] || 'Someone'} posted a help request`,
        body: `${title} - ${subject}`,
    })

    revalidatePath('/help')
    return { success: true, redirect: '/help' }
}

export async function createHelpPostSafe(formData: FormData): Promise<{ success: boolean; redirect?: string; error?: string }> {
    try {
        return await createHelpPost(formData)
    } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        return { success: false, error: error.message || 'Failed to create help post' }
    }
}

export async function updateHelpPost(formData: FormData, helpPostId: string) {
    const user = await requireCurrentUser()

    const title = formData.get('title') as string
    const subject = formData.get('subject') as string
    const category = formData.get('category') as string
    const message = formData.get('message') as string

    if (!title || !subject || !category || !message) {
        throw new Error('Please fill in all fields.')
    }

    const post = await prisma.helpPost.findUnique({
        where: { id: helpPostId },
        select: { authorId: true },
    })

    if (!post) return
    if (!await isAuthorizedOrAdmin(post.authorId, user.id)) {
        throw new Error('Not authorized to edit this help post.')
    }

    await prisma.helpPost.update({
        where: { id: helpPostId },
        data: { title, subject, category, message },
    })

    revalidatePath(`/help/${helpPostId}`);
    return { success: true, redirect: `/help/${helpPostId}` };
}

export async function deleteHelpPost(helpPostId: string) {
    const user = await requireCurrentUser('Log in to delete this help post.')

    const post = await prisma.helpPost.findUnique({
        where: { id: helpPostId },
        select: { authorId: true },
    })

    if (!post) return
    if (!await isAuthorizedOrAdmin(post.authorId, user.id)) {
        throw new Error('Not authorized to delete this help post.')
    }

    // Reverse reputation from votes and comments before deletion
    const voteCounts = await countVotesForTarget(prisma.helpPostVote, 'helpPostId', helpPostId);
    await reverseReputationForContent(post.authorId, voteCounts);
    await reverseContentCommentVoteReputation('help', helpPostId);

    await prisma.helpPost.delete({ where: { id: helpPostId } })

    redirect('/help')
}
