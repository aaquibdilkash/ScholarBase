'use server'

import { Prisma, ContributionStatus } from '@prisma/client'
import prisma from '@/lib/db'
import { requireCurrentUser } from '@/lib/auth'
import { readFormValue, readOptionalFormValue } from '@/lib/form'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { deleteFromCloudinary } from '@/app/actions/cloudinary'
import { notifyFollowersOfActivity } from '@/lib/notifications'

export async function getContributions(q?: string, userId?: string) {
    const where: Prisma.ContributionWhereInput = {
        status: 'APPROVED',
        ...(q
            ? {
                OR: [
                    { title: { contains: q, mode: Prisma.QueryMode.insensitive } },
                    { message: { contains: q, mode: Prisma.QueryMode.insensitive } },
                ],
            }
            : {}),
    }

    return prisma.contribution.findMany({
        where,
        orderBy: { createdAt: 'desc' },
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

export async function getContribution(id: string, userId?: string) {
    return prisma.contribution.findUnique({
        where: { id },
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
                    votes: userId ? { where: { userId } } : false,
                    _count: { select: { votes: true } },
                    replies: {
                        include: {
                            author: true,
                            votes: userId ? { where: { userId } } : false,
                            _count: { select: { votes: true } },
                        },
                        orderBy: { createdAt: 'asc' },
                    },
                },
                orderBy: { createdAt: 'desc' },
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

export async function getAllContributionsAdmin(userId?: string) {
    return prisma.contribution.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
            id: true,
            title: true,
            amount: true,
            upiId: true,
            message: true,
            paymentMethod: true,
            screenshotUrl: true,
            status: true,
            rejectionReason: true,
            approvedAt: true,
            createdAt: true,
            updatedAt: true,
            authorId: true,
            author: {
                select: { id: true, name: true, handle: true, avatarUrl: true, email: true },
            },
            _count: {
                select: { votes: true, comments: true },
            },
        },
    })
}

export async function getContributionForEdit(id: string, userId: string) {
    const contribution = await prisma.contribution.findUnique({
        where: { id },
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
    })

    if (!contribution) return null
    if (contribution.authorId !== userId) throw new Error('Not authorized.')

    return contribution
}

async function requireAdmin() {
    const user = await requireCurrentUser('Please log in.')
    const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { isAdmin: true },
    })
    if (!dbUser?.isAdmin) {
        throw new Error('Not authorized. Admin access required.')
    }
    return user
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

    if (!title || !message) {
        throw new Error('Title and message are required.')
    }

    if (amount !== null && (isNaN(amount) || amount < 1)) {
        throw new Error('Amount must be at least ₹1.')
    }

    const contribution = await prisma.contribution.create({
        data: {
            title,
            message,
            amount,
            upiId,
            paymentMethod,
            screenshotUrl,
            status: 'PENDING',
            authorId: user.id,
        },
    })

    await notifyFollowersOfActivity({
        actorId: user.id,
        type: 'contribution-published',
        targetType: 'contribution',
        targetId: contribution.id,
        title: `${user.email?.split('@')[0] || 'Someone'} made a contribution`,
        body: `${title}${amount ? ` (₹${amount})` : ''}`,
    })

    revalidatePath('/contributions')
    return { success: true }
}

export async function approveContribution(contributionId: string) {
    await requireAdmin()

    const contribution = await prisma.contribution.update({
        where: { id: contributionId },
        data: { status: 'APPROVED', approvedAt: new Date() },
        include: { author: { select: { name: true } } },
    })

    // Award 5 reputation points for approved contribution
    await prisma.user.update({
        where: { id: contribution.authorId },
        data: { reputation: { increment: 5 } },
    })

    // Send notification to contributor
    await prisma.notification.create({
        data: {
            recipientId: contribution.authorId,
            actorId: contribution.authorId,
            type: 'contribution-approved',
            targetType: 'contribution',
            targetId: contributionId,
            title: 'Contribution Approved! 🎉',
            body: `Your contribution "${contribution.title}" has been approved. Thank you for supporting ScholarBase!`,
        },
    }).catch(() => { })

    revalidatePath('/contributions')
    revalidatePath(`/contributions/${contributionId}`)
    revalidatePath('/admin')
}

export async function rejectContribution(contributionId: string, formData?: FormData) {
    await requireAdmin()

    const reason = formData ? formData.get('rejectionReason') as string : null

    const contribution = await prisma.contribution.update({
        where: { id: contributionId },
        data: { status: 'REJECTED', rejectionReason: reason || null },
    })

    // Send notification to contributor
    await prisma.notification.create({
        data: {
            recipientId: contribution.authorId,
            actorId: contribution.authorId,
            type: 'contribution-rejected',
            targetType: 'contribution',
            targetId: contributionId,
            title: 'Contribution Review Update',
            body: reason
                ? `Your contribution "${contribution.title}" was rejected: ${reason}`
                : `Your contribution "${contribution.title}" was rejected.`,
        },
    }).catch(() => { })

    revalidatePath('/contributions')
    revalidatePath(`/contributions/${contributionId}`)
    revalidatePath('/admin')
}

export async function updateContribution(contributionId: string, formData: FormData) {
    const user = await requireCurrentUser('Log in to edit this contribution.')

    const title = readFormValue(formData, 'title')
    const message = readFormValue(formData, 'message')

    const existingContribution = await prisma.contribution.findUnique({
        where: { id: contributionId },
        select: { authorId: true, status: true, screenshotUrl: true },
    })

    if (!existingContribution) return
    if (existingContribution.authorId !== user.id) {
        throw new Error('Not authorized to edit this contribution.')
    }

    // If approved, only allow editing title and message
    if (existingContribution.status === 'APPROVED') {
        await prisma.contribution.update({
            where: { id: contributionId },
            data: { title, message },
        })
    } else {
        const amountStr = readOptionalFormValue(formData, 'amount')
        const upiId = readOptionalFormValue(formData, 'upiId')
        const paymentMethod = readOptionalFormValue(formData, 'paymentMethod')
        const screenshotUrl = readOptionalFormValue(formData, 'screenshotUrl')
        const amount = amountStr ? parseFloat(amountStr) : null

        // Delete old screenshot from Cloudinary if a new one is being set
        if (screenshotUrl && screenshotUrl !== existingContribution.screenshotUrl && existingContribution.screenshotUrl) {
            await deleteFromCloudinary(existingContribution.screenshotUrl);
        }

        // If contribution was rejected, reset status to PENDING for admin re-review
        const status = existingContribution.status === 'REJECTED' ? 'PENDING' : undefined

        await prisma.contribution.update({
            where: { id: contributionId },
            data: { title, message, amount, upiId, paymentMethod, screenshotUrl, ...(status && { status }) },
        })
    }

    revalidatePath('/contributions')
    revalidatePath(`/contributions/${contributionId}`)
    redirect(`/contributions/${contributionId}`)
}

export async function deleteContribution(contributionId: string) {
    const user = await requireCurrentUser('Log in to delete this contribution.')

    const contribution = await prisma.contribution.findUnique({
        where: { id: contributionId },
        select: { authorId: true, screenshotUrl: true },
    })

    if (!contribution) return
    if (contribution.authorId !== user.id) {
        // Admins can also delete
        const admin = await prisma.user.findUnique({
            where: { id: user.id },
            select: { isAdmin: true },
        })
        if (!admin?.isAdmin) {
            throw new Error('Not authorized to delete this contribution.')
        }
    }

    // Delete screenshot from Cloudinary if it exists
    if (contribution.screenshotUrl) {
        await deleteFromCloudinary(contribution.screenshotUrl);
    }

    await prisma.contribution.delete({ where: { id: contributionId } })

    revalidatePath('/contributions')
    revalidatePath('/admin')
    redirect('/contributions')
}

