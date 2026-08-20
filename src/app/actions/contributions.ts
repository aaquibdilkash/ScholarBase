'use server'

import { Prisma } from '@prisma/client'
import prisma from '@/lib/db'
import { requireCurrentUser, isAuthorizedOrAdmin } from '@/lib/auth'
import { readFormValue, readOptionalFormValue } from '@/lib/form'
import { deleteFromCloudinary } from '@/app/actions/cloudinary'
import { notifyFollowersOfActivity } from '@/lib/notifications'

export async function getContributions(q?: string, userId?: string, limit = 20, cursor?: string) {
    const where: Prisma.ContributionWhereInput = {
        isDeleted: false,
        status: 'APPROVED',
        ...(q && {
            OR: [
                { title: { contains: q, mode: 'insensitive' } },
                { message: { contains: q, mode: 'insensitive' } },
            ],
        }),
    }

    return prisma.contribution.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: {
            id: true,
            title: true,
            message: true,
            amount: true,
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
    })
}

export async function getContribution(id: string, userId?: string) {
    return prisma.contribution.findUnique({
        where: { id, isDeleted: false },
        select: {
            id: true,
            title: true,
            amount: true,
            message: true,
            screenshotUrl: true,
            status: true,
            rejectionReason: true,
            authorId: true,
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
            comments: {
                where: { parentId: null },
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    content: true,
                    createdAt: true,
                    updatedAt: true,
            editedAt: true,
                    parentId: true,
                    authorId: true,
                    author: { select: { id: true, name: true, handle: true, avatarUrl: true } },
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
                            parentId: true,
                            authorId: true,
                            author: { select: { id: true, name: true, handle: true, avatarUrl: true } },
                            totalVotes: true,
                            totalReplies: true,
                            votes: userId ? { where: { userId }, select: { voteType: true } } : false,
                        },
                    },
                },
            },
        },
    });
}

export async function getContributionForEdit(id: string, userId: string) {
    const contribution = await prisma.contribution.findUnique({
        where: { id, isDeleted: false },
        select: {
            id: true,
            title: true,
            message: true,
            amount: true,
            upiId: true,
            paymentMethod: true,
            screenshotUrl: true,
            status: true,
            authorId: true,
        },
    });

    if (!contribution) return null;
    if (!await isAuthorizedOrAdmin(contribution.authorId, userId)) return null;

    return contribution;
}

export async function createContribution(formData: FormData) {
    const user = await requireCurrentUser('Please log in to submit a contribution.')

    const title = readFormValue(formData, 'title')
    const message = readFormValue(formData, 'message')
    const amountStr = readOptionalFormValue(formData, 'amount')
    const upiId = readOptionalFormValue(formData, 'upiId')
    const paymentMethod = readOptionalFormValue(formData, 'paymentMethod')
    const screenshotUrl = readOptionalFormValue(formData, 'screenshotUrl')
    const amount = amountStr ? parseFloat(amountStr) : null

    if (!title || !message) throw new Error('Title and message are required.')
    if (amount !== null && (isNaN(amount) || amount < 1)) throw new Error('Amount must be at least ₹1.')

    const contribution = await prisma.$transaction(async (tx) => {
        const newContribution = await tx.contribution.create({
            data: {
                title, message, amount, upiId, paymentMethod, screenshotUrl,
                status: 'PENDING',
                authorId: user.id,
            },
        });

        await tx.userActivity.create({
            data: {
                userId: user.id,
                action: 'PUBLISHED',
                 moduleType: 'CONTRIBUTION',
                entityId: newContribution.id,
                entityTitle: newContribution.title.substring(0, 100),
            }
        });

        return newContribution;
    });

    // This is a fire-and-forget notification
    notifyFollowersOfActivity({
        actorId: user.id,
        type: 'contribution-published',
        targetType: 'Contribution',
        targetId: contribution.id,
        title: `${user.user_metadata?.name || user.email?.split('@')[0] || 'Someone'} made a contribution`,
        body: `${title}${amount ? ` (₹${amount})` : ''}`,
    })

    return { success: true, data: contribution }
}

export async function updateContribution(contributionId: string, formData: FormData) {
    const user = await requireCurrentUser('Log in to edit this contribution.')

    const existingContribution = await prisma.contribution.findUnique({
        where: { id: contributionId },
        select: { authorId: true, status: true, screenshotUrl: true },
    })

    if (!existingContribution) throw new Error('Contribution not found.')
    if (!await isAuthorizedOrAdmin(existingContribution.authorId, user.id)) throw new Error('Not authorized.')

    const title = readFormValue(formData, 'title')
    const message = readFormValue(formData, 'message')

    // If approved, only allow editing title and message
    if (existingContribution.status === 'APPROVED') {
        const updatedContribution = await prisma.contribution.update({
            where: { id: contributionId },
            data: { title, message, editedAt: new Date() },
        })
        return { success: true, data: updatedContribution }
    } 
    
    // Otherwise, allow editing all fields
    const amountStr = readOptionalFormValue(formData, 'amount')
    const upiId = readOptionalFormValue(formData, 'upiId')
    const paymentMethod = readOptionalFormValue(formData, 'paymentMethod')
    const screenshotUrl = readOptionalFormValue(formData, 'screenshotUrl')
    const amount = amountStr ? parseFloat(amountStr) : null

    const oldScreenshot = existingContribution.screenshotUrl;
    const newScreenshot = screenshotUrl || null;

    // If it was rejected, move it back to pending on edit
    const status = existingContribution.status === 'REJECTED' ? 'PENDING' : undefined

    const updatedContribution = await prisma.contribution.update({
        where: { id: contributionId },
        data: { title, message, amount, upiId, paymentMethod, screenshotUrl, editedAt: new Date(), ...(status && { status }) },
    })

    if (oldScreenshot && oldScreenshot !== newScreenshot) {
        await deleteFromCloudinary(oldScreenshot);
    }

    return { success: true, data: updatedContribution }
}

export async function deleteContribution(contributionId: string) {
    const user = await requireCurrentUser('Log in to delete this contribution.')

    const contribution = await prisma.contribution.findUnique({
        where: { id: contributionId },
        select: { authorId: true },
    })

    if (!contribution) throw new Error('Contribution not found.')
    if (!await isAuthorizedOrAdmin(contribution.authorId, user.id)) {
        throw new Error('Not authorized to delete this contribution.')
    }
    
    await prisma.contribution.update({
        where: { id: contributionId },
        data: { isDeleted: true },
    })

    // The screenshot is intentionally NOT deleted from Cloudinary on soft delete.
    return { success: true, data: { deletedId: contributionId } }
}

// Note: Admin-specific actions like approve/reject are in `admin.ts`
// and are assumed to be refactored separately.
