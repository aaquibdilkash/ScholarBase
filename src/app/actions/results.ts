'use server'

import { Prisma } from '@prisma/client'
import prisma from '@/lib/db'
import { requireCurrentUser, isAuthorizedOrAdmin } from '@/lib/auth'
import { readFormValue, readOptionalFormValue } from '@/lib/form'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { notifyFollowersOfActivity } from '@/lib/notifications'
import { countVotesForTarget, reverseReputationForContent, reverseContentCommentVoteReputation } from '@/app/actions/interactions'

export async function getResults(q?: string, userId?: string) {
    const where = q
        ? {
            OR: [
                { title: { contains: q, mode: Prisma.QueryMode.insensitive } },
                { description: { contains: q, mode: Prisma.QueryMode.insensitive } },
                { category: { contains: q, mode: Prisma.QueryMode.insensitive } },
                { conductingBody: { contains: q, mode: Prisma.QueryMode.insensitive } },
                { session: { contains: q, mode: Prisma.QueryMode.insensitive } },
            ],
        }
        : {};

    return prisma.result.findMany({
        where,
        orderBy: { createdAt: "desc" },
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
    });
}

export async function getResult(id: string, userId?: string) {
    return prisma.result.findUnique({
        where: { id: id },
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
                select: { votes: true, comments: true },
            },
        },
    });
}

export async function createResult(formData: FormData) {
    const user = await requireCurrentUser('Please log in to submit details.')

    const title = readFormValue(formData, 'title')
    const description = readFormValue(formData, 'description')
    const type = readFormValue(formData, 'type')
    const category = readOptionalFormValue(formData, 'category')
    const conductingBody = readOptionalFormValue(formData, 'conductingBody')
    const session = readOptionalFormValue(formData, 'session')
    const notificationLink = readOptionalFormValue(formData, 'notificationLink')
    const resultLink = readOptionalFormValue(formData, 'resultLink')

    const result = await prisma.result.create({
        data: { title, description, type, category, conductingBody, session, notificationLink, resultLink, authorId: user.id },
    })

    await notifyFollowersOfActivity({
        actorId: user.id,
        type: 'result-published',
        targetType: 'result',
        targetId: result.id,
        title: `${user.email?.split('@')[0] || 'Someone'} posted a new result`,
        body: `${title}${category ? ` (${category})` : ''}${conductingBody ? ` - ${conductingBody}` : ''}`,
    })

    revalidatePath('/results')
    return { success: true, redirect: '/results' }
}

export async function updateResult(formData: FormData, resultId: string) {
    const user = await requireCurrentUser('Log in to edit this result.')

    const title = readFormValue(formData, 'title')
    const description = readFormValue(formData, 'description')
    const type = readFormValue(formData, 'type')
    const category = readOptionalFormValue(formData, 'category')
    const conductingBody = readOptionalFormValue(formData, 'conductingBody')
    const session = readOptionalFormValue(formData, 'session')
    const notificationLink = readOptionalFormValue(formData, 'notificationLink')
    const resultLink = readOptionalFormValue(formData, 'resultLink')

    const result = await prisma.result.findUnique({
        where: { id: resultId },
        select: { authorId: true },
    })

    if (!result) return
    if (!await isAuthorizedOrAdmin(result.authorId, user.id)) {
        throw new Error('Not authorized to edit this result.')
    }

    await prisma.result.update({
        where: { id: resultId },
        data: { title, description, type, category, conductingBody, session, notificationLink, resultLink },
    })

    revalidatePath('/results')
    revalidatePath(`/results/${resultId}`)
    return { success: true, redirect: `/results/${resultId}` }
}

export async function deleteResult(resultId: string) {
    const user = await requireCurrentUser('Log in to delete this result.')

    const result = await prisma.result.findUnique({
        where: { id: resultId },
        select: { authorId: true },
    })

    if (!result) return
    if (!await isAuthorizedOrAdmin(result.authorId, user.id)) {
        throw new Error('Not authorized to delete this result.')
    }

    // Reverse reputation from votes and comments before deletion
    const voteCounts = await countVotesForTarget(prisma.resultVote, 'resultId', resultId);
    await reverseReputationForContent(result.authorId, voteCounts);
    await reverseContentCommentVoteReputation('result', resultId);

    await prisma.result.delete({ where: { id: resultId } })

    revalidatePath('/results')
    revalidatePath(`/results/${resultId}`)
    redirect('/results')
}
