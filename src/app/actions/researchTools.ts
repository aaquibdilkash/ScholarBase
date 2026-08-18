'use server'

import { Prisma } from '@prisma/client'
import prisma from '@/lib/db'
import { requireCurrentUser, isAuthorizedOrAdmin } from '@/lib/auth'
import { readFormValue } from '@/lib/form'
import { notifyFollowersOfActivity } from '@/lib/notifications'
import { countVotesForTarget, reverseReputationForContent, reverseContentCommentVoteReputation } from '@/app/actions/interactions'

export async function createResearchTool(formData: FormData) {
    const user = await requireCurrentUser('Please log in to submit details.')

    const name = readFormValue(formData, 'name')
    const website = readFormValue(formData, 'website')
    const use = readFormValue(formData, 'use')
    const description = readFormValue(formData, 'description')

    const tool = await prisma.researchTool.create({
        data: {
            name,
            website,
            use,
            description,
            authorId: user.id
        },
        include: {
            author: true,
            votes: true,
            _count: {
                select: { votes: true, comments: true },
            },
        }
    })

    await notifyFollowersOfActivity({
        actorId: user.id,
        type: 'research-tool-published',
        targetType: 'researchTool',
        targetId: tool.id,
        title: `${user.email?.split('@')[0] || 'Someone'} added a new research tool`,
        body: `${name} - ${use}`,
    })

    return { success: true, data: tool }
}

export async function updateResearchTool(formData: FormData, toolId: string) {
    const user = await requireCurrentUser('Log in to edit this research tool.')

    const name = readFormValue(formData, 'name')
    const website = readFormValue(formData, 'website')
    const use = readFormValue(formData, 'use')
    const description = readFormValue(formData, 'description')

    const tool = await prisma.researchTool.findUnique({
        where: { id: toolId },
        select: { authorId: true },
    })

    if (!tool) {
        throw new Error('Research tool not found.')
    }
    if (!await isAuthorizedOrAdmin(tool.authorId, user.id)) {
        throw new Error('Not authorized to edit this research tool.')
    }

    const updatedTool = await prisma.researchTool.update({
        where: { id: toolId },
        data: { name, website, use, description },
        include: {
            author: true,
            votes: true,
            _count: {
                select: { votes: true, comments: true },
            },
        }
    })

    return { success: true, data: updatedTool }
}

export async function deleteResearchTool(toolId: string) {
    const user = await requireCurrentUser('Log in to delete this research tool.')

    const tool = await prisma.researchTool.findUnique({
        where: { id: toolId },
        select: { authorId: true },
    })

    if (!tool) {
        throw new Error('Research tool not found.')
    }
    if (!await isAuthorizedOrAdmin(tool.authorId, user.id)) {
        throw new Error('Not authorized to delete this research tool.')
    }

    // Reverse reputation from votes and comments before deletion
    const voteCounts = await countVotesForTarget(prisma.researchToolVote, 'researchToolId', toolId);
    await reverseReputationForContent(tool.authorId, voteCounts);
    await reverseContentCommentVoteReputation('researchTool', toolId);

    await prisma.researchTool.delete({ where: { id: toolId } })

    return { success: true, data: { deletedId: toolId } }
}


export async function getResearchTools(q?: string, userId?: string, limit = 20, cursor?: string) {
    const where = q
        ? {
            OR: [
                { name: { contains: q, mode: Prisma.QueryMode.insensitive } },
                { website: { contains: q, mode: Prisma.QueryMode.insensitive } },
                { use: { contains: q, mode: Prisma.QueryMode.insensitive } },
                { description: { contains: q, mode: Prisma.QueryMode.insensitive } },
            ],
        }
        : {};

    return prisma.researchTool.findMany({
        where,
        orderBy: {
            createdAt: 'desc',
        },
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
                select: { userId: true, voteType: true },
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

export async function getResearchToolById(toolId: string, userId?: string) {
    return prisma.researchTool.findUniqueOrThrow({
        where: {
            id: toolId,
        },
        select: {
            id: true,
            name: true,
            website: true,
            use: true,
            description: true,
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
                orderBy: { createdAt: "desc" },
            },
            votes: {
                select: { userId: true, voteType: true },
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
