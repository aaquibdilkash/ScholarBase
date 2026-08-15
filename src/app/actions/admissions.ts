'use server'

import { Prisma } from '@prisma/client'
import prisma from '@/lib/db'
import { requireCurrentUser, isAuthorizedOrAdmin } from '@/lib/auth'
import { readFormValue } from '@/lib/form'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { notifyFollowersOfActivity } from '@/lib/notifications'
import { countVotesForTarget, reverseReputationForContent, reverseContentCommentVoteReputation } from '@/app/actions/interactions'

export async function getAdmissions(q?: string, userId?: string) {
    const where = q
        ? {
            OR: [
                { university: { contains: q, mode: Prisma.QueryMode.insensitive } },
                { department: { contains: q, mode: Prisma.QueryMode.insensitive } },
                { description: { contains: q, mode: Prisma.QueryMode.insensitive } },
            ],
        }
        : {};

    return prisma.phdAdmission.findMany({
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

export async function getAdmission(id: string, userId?: string) {
    return prisma.phdAdmission.findUnique({
        where: { id },
        select: {
            id: true,
            university: true,
            department: true,
            deadline: true,
            description: true,
            notificationLink: true,
            applyLink: true,
            createdAt: true,
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
                select: { votes: true, comments: true },
            },
        },
    });
}

export async function createPhdAdmission(formData: FormData) {
    const user = await requireCurrentUser('Please log in to submit details.')

    const university = readFormValue(formData, 'university')
    const department = readFormValue(formData, 'department')
    const deadline = new Date(readFormValue(formData, 'deadline'))
    const description = readFormValue(formData, 'description')
    const notificationLink = readFormValue(formData, 'notificationLink')
    const applyLink = readFormValue(formData, 'applyLink')

    if (!notificationLink || !applyLink) {
        throw new Error('Notification and Apply links are required.')
    }

    const admission = await prisma.phdAdmission.create({
        data: { university, department, deadline, description, notificationLink, applyLink, authorId: user.id },
    })

    await notifyFollowersOfActivity({
        actorId: user.id,
        type: 'admission-published',
        targetType: 'admission',
        targetId: admission.id,
        title: `${user.email?.split('@')[0] || 'Someone'} posted a new PhD admission`,
        body: `${department} at ${university} - Deadline: ${deadline.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
    })

    revalidatePath('/admissions')
    return { success: true, redirect: '/admissions' }
}

export async function createAdmissionSafe(formData: FormData): Promise<{ success: boolean; redirect?: string; error?: string }> {
    try {
        return await createPhdAdmission(formData);
    } catch (err: unknown) {
        if (err instanceof Error) {
            return { success: false, error: err.message };
        }
        return { success: false, error: 'Failed to create admission post' };
    }
}

export async function updatePhdAdmission(formData: FormData, admissionId: string) {
    const user = await requireCurrentUser('Log in to edit this admission.')

    const university = readFormValue(formData, 'university')
    const department = readFormValue(formData, 'department')
    const deadline = new Date(readFormValue(formData, 'deadline'))
    const description = readFormValue(formData, 'description')
    const notificationLink = readFormValue(formData, 'notificationLink')
    const applyLink = readFormValue(formData, 'applyLink')

    if (!notificationLink || !applyLink) {
        throw new Error('Notification and Apply links are required.')
    }

    const admission = await prisma.phdAdmission.findUnique({
        where: { id: admissionId },
        select: { authorId: true },
    })

    if (!admission) return
    if (!await isAuthorizedOrAdmin(admission.authorId, user.id)) {
        throw new Error('Not authorized to edit this admission.')
    }

    await prisma.phdAdmission.update({
        where: { id: admissionId },
        data: { university, department, deadline, description, notificationLink, applyLink },
    })

    revalidatePath('/admissions')
    revalidatePath(`/admissions/${admissionId}`)
    return { success: true, redirect: `/admissions/${admissionId}` }
}

export async function deletePhdAdmission(admissionId: string) {
    const user = await requireCurrentUser('Log in to delete this admission.')

    const admission = await prisma.phdAdmission.findUnique({
        where: { id: admissionId },
        select: { authorId: true },
    })

    if (!admission) return
    if (!await isAuthorizedOrAdmin(admission.authorId, user.id)) {
        throw new Error('Not authorized to delete this admission.')
    }

    // Reverse reputation from votes and comments before deletion
    const voteCounts = await countVotesForTarget(prisma.phdAdmissionVote, 'phdAdmissionId', admissionId);
    await reverseReputationForContent(admission.authorId, voteCounts);
    await reverseContentCommentVoteReputation('admission', admissionId);

    await prisma.phdAdmission.delete({ where: { id: admissionId } })

    revalidatePath('/admissions')
    revalidatePath(`/admissions/${admissionId}`)
    redirect('/admissions')
}

export async function getLatestAdmissions(count: number, userId?: string) {
    return prisma.phdAdmission.findMany({
        where: {
            deadline: {
                gte: new Date(),
            },
        },
        take: count,
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
                select: {
                    userId: true,
                    voteType: true,
                },
            },
            _count: {
                select: { votes: true, comments: true },
            },
        },
    });
}
