'use server'

import prisma from '@/lib/db'
import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createSocialPost(formData: FormData) {
    // 1. Verify the user is logged in
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        throw new Error("You must be logged in to post.")
    }

    // 2. Extract the text content
    const content = formData.get('content') as string
    if (!content || content.trim() === '') return

    // 3. Save to Prisma using the User's exact Supabase ID
    await prisma.socialPost.create({
        data: {
            content,
            authorId: user.id, // This links the post to the User table
        }
    })

    // 4. Refresh the feed
    revalidatePath('/feed')
}