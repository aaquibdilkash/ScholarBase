'use server'

import { Prisma } from '@prisma/client'
import prisma from '@/lib/db'
import { requireCurrentUser, isAuthorizedOrAdmin } from '@/lib/auth'
import { readFormValue } from '@/lib/form'
import { notifyFollowersOfActivity } from '@/lib/notifications'

export async function createResearchTool(formData: FormData) {
    const user = await requireCurrentUser('Please log in to submit details.')

    const name = readFormValue(formData, 'name')
    const website = readFormValue(formData, 'website')
    const use = readFormValue(formData, 'use')
    const description = readFormValue(formData, 'description')

    const tool = await prisma.$transaction(async (tx) => {
        const newTool = await tx.researchTool.create({
            data: {
                name,
                website,
                use,
                description,
                authorId: user.id
            }
        });

        await tx.userActivity.create({
            data: {
                userId: user.id,
                action: 'PUBLISHED',
                moduleType: 'RESEARCH_TOOL',
                entityId: newTool.id,
                entityTitle: newTool.name,
            }
        });
        await tx.user.update({
            where: { id: user.id },
            data: { researchToolCount: { increment: 1 } },
        })

        return newTool;
    });

    await notifyFollowersOfActivity({
        actorId: user.id,
        type: 'research-tool-published',
        targetType: 'ResearchTool',
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
        data: { name, website, use, description, editedAt: new Date() },
    })

    return { success: true, data: updatedTool }
}

export async function deleteResearchTool(toolId: string) {
    const user = await requireCurrentUser('Log in to delete this research tool.')

    const tool = await prisma.researchTool.findUnique({
        where: { id: toolId },
        select: { authorId: true, totalVotes: true },
    })

    if (!tool) {
        throw new Error('Research tool not found.')
    }
    if (!await isAuthorizedOrAdmin(tool.authorId, user.id)) {
        throw new Error('Not authorized to delete this research tool.')
    }

    await prisma.$transaction(async (tx) => {
        await tx.researchTool.update({ where: { id: toolId }, data: { isDeleted: true } })

        await tx.user.update({
            where: { id: tool.authorId },
            data: { researchToolCount: { decrement: 1 } },
        })

        if (tool.totalVotes !== 0) {
            await tx.user.update({
                where: { id: tool.authorId },
                data: { reputation: { decrement: tool.totalVotes } },
            })
        }
    })

    return { success: true, data: { deletedId: toolId } }
}


export async function getResearchTools(q?: string, userId?: string, limit = 20, cursor?: string) {
    const where: Prisma.ResearchToolWhereInput = {
        isDeleted: false,
        ...(q && {
            OR: [
                { name: { contains: q, mode: Prisma.QueryMode.insensitive } },
                { website: { contains: q, mode: Prisma.QueryMode.insensitive } },
                { use: { contains: q, mode: Prisma.QueryMode.insensitive } },
                { description: { contains: q, mode: Prisma.QueryMode.insensitive } },
            ],
        })
    };

    return prisma.researchTool.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: {
            id: true,
            name: true,
            website: true,
            use: true,
            description: true,
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
            totalComments: true,
            votes: userId ? { where: { userId }, select: { userId: true, voteType: true } } : false,
        },
    });
}

export async function getResearchToolById(toolId: string, userId?: string) {
    return prisma.researchTool.findUniqueOrThrow({
        where: { id: toolId, isDeleted: false },
        select: {
            id: true,
            name: true,
            website: true,
            use: true,
            description: true,
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
            totalComments: true,
            votes: userId ? { where: { userId }, select: { userId: true, voteType: true } } : false,
            comments: {
                where: { parentId: null },
                orderBy: { createdAt: "desc" },
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
                    votes: userId ? { where: { userId }, select: { userId: true, voteType: true } } : false,
                    replies: {
                        orderBy: { createdAt: "asc" },
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
                            votes: userId ? { where: { userId }, select: { userId: true, voteType: true } } : false,
                        },
                    },
                },
            },
        },
    });
}
