'use server'

import prisma from '@/lib/db'
import { requireCurrentUser } from '@/lib/auth'
import { readFormValue } from '@/lib/form'
import { redirect } from 'next/navigation'

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
        redirect(`/supervisor/${supervisorId}`)
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
    })


    redirect(`/supervisor/${supervisorId}`)
}

