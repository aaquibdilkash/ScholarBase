'use server'

import prisma from '@/lib/db'
import { requireCurrentUser, isAuthorizedOrAdmin } from '@/lib/auth'
import { readFormValue } from '@/lib/form'
import { redirect } from 'next/navigation';
import { reverseReputationForRecommendation } from '@/app/actions/interactions';

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

    await prisma.recommendation.create({
        data: {
            rating,
            feedback,
            turnaroundTimeDays,
            responsivenessScore,
            guidanceScore,
            supervisorId,
            authorId: user.id,
        },
    });

    // Award 2 reputation points for the recommendation
    await prisma.user.update({
        where: { id: user.id },
        data: { reputation: { increment: 2 } },
    });

    return { success: true, redirect: `/supervisor/${supervisorId}` }
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

    const recommendation = await prisma.recommendation.findUnique({
        where: { id: recommendationId },
        select: { authorId: true, supervisorId: true },
    })

    if (!recommendation) return
    if (!await isAuthorizedOrAdmin(recommendation.authorId, user.id)) {
        throw new Error('Not authorized to edit this recommendation.')
    }

    await prisma.recommendation.update({
        where: { id: recommendationId },
        data: {
            rating,
            feedback,
            turnaroundTimeDays,
            responsivenessScore,
            guidanceScore,
        },
    })

    redirect(`/supervisor/${recommendation.supervisorId}/recommendation/${recommendationId}`)

}

export async function deleteRecommendation(recommendationId: string) {
    const user = await requireCurrentUser('Log in to delete this recommendation.')

    const recommendation = await prisma.recommendation.findUnique({
        where: { id: recommendationId },
        select: { authorId: true, supervisorId: true },
    })

    if (!recommendation) return
    if (!await isAuthorizedOrAdmin(recommendation.authorId, user.id)) {
        throw new Error('Not authorized to delete this recommendation.')
    }

    // Reverse reputation before deleting
    await reverseReputationForRecommendation(recommendationId);

    await prisma.recommendation.delete({ where: { id: recommendationId } })

    redirect(`/supervisor/${recommendation.supervisorId}`)
}


