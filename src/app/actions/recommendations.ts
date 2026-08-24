'use server'

import prisma from '@/lib/db'
import { requireCurrentUser, isAuthorizedOrAdmin } from '@/lib/auth'
import { readFormValue } from '@/lib/form'

export async function createRecommendation(formData: FormData, supervisorId: string) {
    const user = await requireCurrentUser(
        'Log in to share your recommendation and help other scholars!'
    )

    const feedback = readFormValue(formData, 'feedback')
    const rating = Number.parseInt(readFormValue(formData, 'rating'), 10)

    const turnaroundTimeDays = Number.parseInt(
        readFormValue(formData, 'turnaroundTimeDays'),
        10,
    )
    const responsivenessScore = Number.parseInt(
        readFormValue(formData, 'responsivenessScore'),
        10,
    )
    const guidanceScore = Number.parseInt(
        readFormValue(formData, 'guidanceScore'),
        10,
    )
    const isAnonymous = formData.has('isAnonymous')


    // Prevent duplicate recommendations (e.g., if user navigates directly to this page
    // even after the UI hides the “recommend” button).
    const existing = await prisma.recommendation.findFirst({
        where: {
            supervisorId,
            authorId: user.id,
        },
        select: { id: true },
    })

    if (existing) {
        return { success: false, error: 'You already have a recommendation for this supervisor.' }
    }

    const recommendation = await prisma.$transaction(async (tx) => {
        const newRecommendation = await tx.recommendation.create({
            data: {
                rating,
                feedback,
                turnaroundTimeDays,
                responsivenessScore,
                guidanceScore,
                isAnonymous,
                supervisorId,
                authorId: user.id,
            },
        });

        await tx.userActivity.create({
            data: {
                userId: user.id,
                action: 'PUBLISHED',
                 moduleType: 'RECOMMENDATION',
                entityId: newRecommendation.id,
                entityTitle: `Recommendation for supervisor ${supervisorId}`.substring(0, 100),
            }
        });

        if (!isAnonymous) {
            await tx.user.update({
                where: { id: user.id },
                data: { recommendationCount: { increment: 1 } },
            })
        }

        return newRecommendation;
    });

    return { success: true, data: recommendation }
}

export async function updateRecommendation(formData: FormData, recommendationId: string) {
    const user = await requireCurrentUser('Log in to edit this recommendation.')

    const feedback = readFormValue(formData, 'feedback')
    const rating = Number.parseInt(readFormValue(formData, 'rating'), 10)

    const turnaroundTimeDays = Number.parseInt(
        readFormValue(formData, 'turnaroundTimeDays'),
        10,
    )
    const responsivenessScore = Number.parseInt(
        readFormValue(formData, 'responsivenessScore'),
        10,
    )
    const guidanceScore = Number.parseInt(
        readFormValue(formData, 'guidanceScore'),
        10,
    )
    const isAnonymous = formData.has('isAnonymous')

    const recommendation = await prisma.recommendation.findUnique({
        where: { id: recommendationId },
        select: { authorId: true, supervisorId: true, isAnonymous: true },
    })

    if (!recommendation) {
        throw new Error('Recommendation not found.')
    }
    if (!await isAuthorizedOrAdmin(recommendation.authorId, user.id)) {
        throw new Error('Not authorized to edit this recommendation.')
    }

    const updatedRecommendation = await prisma.recommendation.update({
        where: { id: recommendationId },
        data: {
            rating,
            feedback,
            turnaroundTimeDays,
            responsivenessScore,
            guidanceScore,
            isAnonymous,
            editedAt: new Date(),
        },
    })

    return { success: true, data: updatedRecommendation }
}


export async function deleteRecommendation(recommendationId: string) {
    const user = await requireCurrentUser('Log in to delete this recommendation.')

    const recommendation = await prisma.recommendation.findUnique({
        where: { id: recommendationId },
        select: { authorId: true, supervisorId: true, totalVotes: true, isAnonymous: true },
    })

    if (!recommendation) {
        throw new Error('Recommendation not found.')
    }
    if (!await isAuthorizedOrAdmin(recommendation.authorId, user.id)) {
        throw new Error('Not authorized to delete this recommendation.')
    }

    await prisma.$transaction(async (tx) => {
        await tx.recommendation.update({ where: { id: recommendationId }, data: { isDeleted: true } })

        if (!recommendation.isAnonymous) {
            await tx.user.update({
                where: { id: recommendation.authorId },
                data: { recommendationCount: { decrement: 1 } },
            })
        }

        if (recommendation.totalVotes !== 0) {
            await tx.user.update({
                where: { id: recommendation.authorId },
                data: { reputation: { decrement: recommendation.totalVotes } },
            })
        }
    })

    return { success: true, data: { deletedId: recommendationId, supervisorId: recommendation.supervisorId } }
}

