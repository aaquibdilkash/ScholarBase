'use server'

import prisma from '@/lib/db'
import { requireCurrentUser } from '@/lib/auth'
import { readFormValue, readOptionalFormValue } from '@/lib/form'
import { redirect } from 'next/navigation'

export async function createReview(formData: FormData, supervisorId: string) {
    const user = await requireCurrentUser('Log in to share your recommendation and help other scholars!')

    const feedback = readFormValue(formData, 'feedback')
    const rating = Number.parseInt(readFormValue(formData, 'rating'), 10)
    const turnaround = readOptionalFormValue(formData, 'turnaround') ?? 'Not specified'

    await prisma.review.create({
        data: {
            feedback,
            rating,
            turnaround,
            supervisorId,
            userId: user.id,
        },
    })

    redirect(`/supervisor/${supervisorId}`)
}