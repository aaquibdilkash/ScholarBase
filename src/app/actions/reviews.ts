// src/app/actions/reviews.ts

'use server'

import { createClient } from '@/utils/supabase/server'
import prisma from '@/lib/db'
import { redirect } from 'next/navigation'

export async function createReview(formData: FormData, supervisorId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // Guard Clause: If user isn't logged in, redirect with a contextual value message
    if (!user) {
        const loginMessage = encodeURIComponent("Log in to share your recommendation and help other scholars!")
        redirect(`/login?message=${loginMessage}`)
    }

    const feedback = formData.get('feedback') as string
    const rating = parseInt(formData.get('rating') as string)
    const turnaround = (formData.get('turnaround') as string) || "Not specified"

    // Persisting the user-submitted recommendation into the Database
    await prisma.review.create({
        data: {
            feedback,
            rating,
            turnaround,
            supervisorId,
            userId: user.id
        }
    })

    // Send the authenticated user back to the primary supervisor overview page
    redirect(`/supervisor/${supervisorId}`)
}