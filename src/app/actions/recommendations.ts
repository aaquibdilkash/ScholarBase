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

    // Recommendation model currently stores only `content`.
    // Merge review + recommendation by encoding rating into the content.
    const content = `Mentorship rating: ${rating}/5\n\n${feedback}`

    await prisma.recommendation.create({
        data: {
            content,
            supervisorId,
            authorId: user.id,
        },
    })

    redirect(`/supervisor/${supervisorId}`)
}
