'use server'

import { Prisma } from '@prisma/client'
import prisma from '@/lib/db'
import { requireCurrentUser, isAuthorizedOrAdmin } from '@/lib/auth'
import { notifyFollowersOfActivity } from '@/lib/notifications'

export async function getHelpPosts(q?: string, userId?: string, limit = 20, cursor?: string) {
    const where: Prisma.HelpPostWhereInput = {
        isDeleted: false,
        ...(q && {
            OR: [
                { title: { contains: q, mode: 'insensitive' } },
                { subject: { contains: q, mode: 'insensitive' } },
                { message: { contains: q, mode: 'insensitive' } },
            ],
        })
    };

    // RULE 6: The query is already optimized with filtered selects and materialized counters.
    // The `.map()` transformation has been removed to stop doing server-side computation.
    // The client is now responsible for deriving `isFollowing` and `userVote`.
    return prisma.helpPost.findMany({
        where,
        orderBy: {
            createdAt: 'desc',
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

export async function getHelpPost(id: string, userId?: string) {
    if (!id || typeof id !== 'string') {
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
                    followers: userId ? { where: { followerId: userId }, select: { followerId: true } } : false,
                },
            },
            totalVotes: true,
            totalComments: true,
            votes: userId ? { where: { userId }, select: { voteType: true } } : false,
            comments: {
                where: { parentId: null },
                select: {
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
                    votes: userId ? { where: { userId }, select: { voteType: true } } : false,
                    replies: {
                        select: {
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
                            votes: userId ? { where: { userId }, select: { voteType: true } } : false,
                        },
                        orderBy: { createdAt: "asc" },
                    },
                },
                orderBy: { createdAt: 'desc' }
            }
        },
    });
}

export async function createHelpPost(formData: FormData) {
    const user = await requireCurrentUser('You must be logged in to create a post.')
    const title = formData.get('title') as string
    const subject = formData.get('subject') as string
    const category = formData.get('category') as string
    const message = formData.get('message') as string

    if (!title || !subject || !category || !message) {
        throw new Error('Please fill in all fields.')
    }

    const post = await prisma.$transaction(async (tx) => {
        const newPost = await tx.helpPost.create({
            data: {
                title,
                subject,
                category,
                message,
                authorId: user.id,
            }
        });

        await tx.userActivity.create({
            data: {
                userId: user.id,
                action: 'PUBLISHED',
                 moduleType: 'HELP_POST',
                entityId: newPost.id,
                entityTitle: newPost.title,
            }
        });

        return newPost;
    });

    // Fire-and-forget notification
    notifyFollowersOfActivity({
        actorId: user.id,
        type: 'help-post-published',
        targetType: 'HelpPost',
        targetId: post.id,
        title: `${user.user_metadata?.name || user.email?.split('@')[0] || 'Someone'} posted a help request`,
        body: post.title,
    })

    return { success: true, data: post }
}

export async function updateHelpPost(formData: FormData, helpPostId: string) {
    const user = await requireCurrentUser('You must be logged in to update a post.')

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

    if (!post) {
		throw new Error('Help post not found.')
	}
    if (!await isAuthorizedOrAdmin(post.authorId, user.id)) {
        throw new Error('Not authorized to edit this help post.')
    }

    const updatedPost = await prisma.helpPost.update({
        where: { id: helpPostId },
        data: { title, subject, category, message, editedAt: new Date() },
    })

    return { success: true, data: updatedPost };
}

export async function deleteHelpPost(helpPostId: string) {
    const user = await requireCurrentUser('Log in to delete this help post.')

    const post = await prisma.helpPost.findUnique({
        where: { id: helpPostId },
        select: { authorId: true },
    })

    if (!post) {
		throw new Error('Help post not found.');
	}
    if (!await isAuthorizedOrAdmin(post.authorId, user.id)) {
        throw new Error('Not authorized to delete this help post.')
    }

    // Soft delete the post
    await prisma.helpPost.update({
        where: { id: helpPostId },
        data: { isDeleted: true },
    })

    return { success: true, data: { deletedId: helpPostId } }
}
