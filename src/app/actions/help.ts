'use server'

import { Prisma } from '@prisma/client'
import prisma from '@/lib/db'
import { requireCurrentUser, isAuthorizedOrAdmin } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { notifyFollowersOfActivity } from '@/lib/notifications'
import { countVotesForTarget, countCommentsForTarget, reverseReputationForContent } from '@/app/actions/interactions'

export async function getHelpPosts(q?: string, userId?: string) {
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
        include: {
            author: {
                include: {
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
                include: {
                    author: true,
                    votes: { where: { userId } },
                    _count: { select: { votes: true } },
                    replies: {
                        include: {
                            author: true,
                            votes: { where: { userId } },
                            _count: { select: { votes: true } },
                        },
                        orderBy: { createdAt: "asc" },
                    },
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
        return await createHelpPost(formData) as any
    } catch (err: any) {
        return { success: false, error: err.message || 'Failed to create help post' }
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

    redirect(`/help/${helpPostId}`)
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
    const commentCount = await countCommentsForTarget(prisma.helpPostComment, 'helpPostId', helpPostId);
    await reverseReputationForContent(post.authorId, voteCounts, commentCount);

    await prisma.helpPost.delete({ where: { id: helpPostId } })

    redirect('/help')
}
