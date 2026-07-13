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

    await prisma.recommendation.create({
        data: {
            rating,
            feedback,
            supervisorId,
            authorId: user.id,
        },
    })

    redirect(`/supervisor/${supervisorId}`)
}

