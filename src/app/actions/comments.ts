'use server'

import { createClient } from '@/utils/supabase/server'
import prisma from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation' // Added this import

export async function createComment(
    formData: FormData,
    targetId: string,
    type: 'article' | 'post',
    parentId?: string // Optional: if provided, this is a reply
) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    // FIX: Safely redirect unauthenticated users with a contextual message
    if (!user) {
        const loginMessage = encodeURIComponent("Log in to join the academic discussion.")
        redirect(`/login?message=${loginMessage}`)
    }

    const content = formData.get('content') as string
    if (!content) return

    if (type === 'article') {
        await prisma.articleComment.create({
            data: { content, articleId: targetId, authorId: user.id, parentId }
        })
    } else {
        await prisma.socialComment.create({
            data: { content, socialPostId: targetId, authorId: user.id, parentId }
        })
    }

    revalidatePath('/blog/[slug]')
    revalidatePath('/feed')
}