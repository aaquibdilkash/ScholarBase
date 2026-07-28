'use server'

import { Prisma } from '@prisma/client'
import prisma from '@/lib/db'
import { requireCurrentUser, isAuthorizedOrAdmin } from '@/lib/auth'
import { readFormValue } from '@/lib/form'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { notifyFollowersOfActivity } from '@/lib/notifications'

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
    })

    await notifyFollowersOfActivity({
        actorId: user.id,
        type: 'research-tool-published',
        targetType: 'researchTool',
        targetId: tool.id,
        title: `${user.email?.split('@')[0] || 'Someone'} added a new research tool`,
        body: `${name} - ${use}`,
    })

    revalidatePath('/research-tools')
    return { success: true, redirect: '/research-tools' }
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

    if (!tool) return
    if (!await isAuthorizedOrAdmin(tool.authorId, user.id)) {
        throw new Error('Not authorized to edit this research tool.')
    }

    await prisma.researchTool.update({
        where: { id: toolId },
        data: { name, website, use, description },
    })

    revalidatePath('/research-tools')
    revalidatePath(`/research-tools/${toolId}`)
    redirect(`/research-tools/${toolId}`)
}

export async function deleteResearchTool(toolId: string) {
    const user = await requireCurrentUser('Log in to delete this research tool.')

    const tool = await prisma.researchTool.findUnique({
        where: { id: toolId },
        select: { authorId: true },
    })

    if (!tool) return
    if (!await isAuthorizedOrAdmin(tool.authorId, user.id)) {
        throw new Error('Not authorized to delete this research tool.')
    }

    await prisma.researchTool.delete({ where: { id: toolId } })

    revalidatePath('/research-tools')
    revalidatePath(`/research-tools/${toolId}`)
    redirect('/research-tools')
}


export async function getResearchTools(q?: string, userId?: string) {
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
            comments: {
                where: { parentId: null },
                include: {
                    author: true,
                    votes: userId ? { where: { userId: userId } } : false,
                    _count: { select: { votes: true } },
                    replies: {
                        include: {
                            author: true,
                            votes: userId ? { where: { userId: userId } } : false,
                            _count: { select: { votes: true } },
                        },
                        orderBy: { createdAt: "asc" },
                    },
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

