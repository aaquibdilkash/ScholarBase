'use server'

import prisma from '@/lib/db'
import { Prisma } from '@prisma/client'
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
    // NOTE: soft-deleted recommendations are excluded so a scholar can write
    // a new one after deleting their previous recommendation.
    const existing = await prisma.recommendation.findFirst({
        where: {
            supervisorId,
            authorId: user.id,
            isDeleted: false,
        },
        select: { id: true },
    })

    if (existing) {
        return { success: false, error: 'You already have a recommendation for this supervisor.' }
    }

                // Defense-in-depth: even with the app-level check above, two simultaneous
    // submissions (or the partial unique index) can raise P2002. Return a
    // friendly error instead of a raw Prisma crash.
    let recommendation;
    try {
        recommendation = await prisma.$transaction(async (tx) => {
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
            // Include the relations the client-side caches expect so optimistic
            // list updates render correctly (owner detection, header, etc.)
            include: {
                author: {
                    select: { id: true, name: true, handle: true, avatarUrl: true },
                },
                supervisor: { select: { id: true, name: true } },
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

        // Materialized supervisor aggregates (Rule 2/3)
        await tx.supervisor.update({
            where: { id: supervisorId },
            data: {
                recommendationCount: { increment: 1 },
                ratingSum: { increment: rating },
            },
        })

                return newRecommendation;
    });
    } catch (error) {
        if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002'
        ) {
            return {
                success: false,
                error: 'You have already submitted a recommendation for this supervisor.',
            }
        }
        throw error
    }

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

    try {
        const recommendation = await prisma.recommendation.findUnique({
            where: { id: recommendationId },
            select: { authorId: true, supervisorId: true, isAnonymous: true, rating: true },
        })

        if (!recommendation) {
            return { success: false as const, error: 'Recommendation not found.' }
        }
        if (!await isAuthorizedOrAdmin(recommendation.authorId, user.id)) {
            return { success: false as const, error: 'Not authorized to edit this recommendation.' }
        }

        const updatedRecommendation = await prisma.$transaction(async (tx) => {
            const updated = await tx.recommendation.update({
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
                include: {
                    // Include relations so client caches render owner/header correctly
                    author: {
                        select: { id: true, name: true, handle: true, avatarUrl: true },
                    },
                    supervisor: { select: { id: true, name: true } },
                },
            })

            // Anonymity toggle: keep the materialized profile counter honest (Rule 3).
            if (!recommendation.isAnonymous && isAnonymous) {
                await tx.user.update({
                    where: { id: recommendation.authorId },
                    data: { recommendationCount: { decrement: 1 } },
                })
            } else if (recommendation.isAnonymous && !isAnonymous) {
                await tx.user.update({
                    where: { id: recommendation.authorId },
                    data: { recommendationCount: { increment: 1 } },
                })
            }

            // Materialized supervisor aggregates (Rule 2/3): a rating edit shifts
            // the running sum; an anonymity flip shifts the count.
            const ratingDelta = rating - recommendation.rating
            const countDelta =
                recommendation.isAnonymous === isAnonymous
                    ? 0
                    : isAnonymous
                        ? -1
                        : 1
            await tx.supervisor.update({
                where: { id: recommendation.supervisorId },
                data: {
                    ...(ratingDelta !== 0 ? { ratingSum: { increment: ratingDelta } } : {}),
                    ...(countDelta !== 0 ? { recommendationCount: { increment: countDelta } } : {}),
                },
            })

            return updated
        })

        return { success: true as const, data: updatedRecommendation }
    } catch (error) {
        if (error instanceof Error && (
            error.message.includes('authorized') ||
            error.message.includes('not found')
        )) {
            return { success: false as const, error: error.message }
        }
        throw error
    }
}

export async function deleteRecommendation(recommendationId: string) {
    const user = await requireCurrentUser('Log in to delete this recommendation.')

    const recommendation = await prisma.recommendation.findUnique({
        where: { id: recommendationId },
        select: { authorId: true, supervisorId: true, totalVotes: true, isAnonymous: true, rating: true },
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

        // Materialized supervisor aggregates (Rule 2/3)
        await tx.supervisor.update({
            where: { id: recommendation.supervisorId },
            data: {
                recommendationCount: { decrement: 1 },
                ratingSum: { decrement: recommendation.rating },
            },
        })

        if (recommendation.totalVotes !== 0) {
            await tx.user.update({
                where: { id: recommendation.authorId },
                data: { reputation: { decrement: recommendation.totalVotes } },
            })
        }
    })

    return { success: true, data: { deletedId: recommendationId, supervisorId: recommendation.supervisorId } }
}

