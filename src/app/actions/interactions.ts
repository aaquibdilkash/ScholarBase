'use server'

import { createClient } from '@/utils/supabase/server'
import prisma from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation' // Added this import

export async function toggleLike(targetId: string, type: 'article' | 'post') {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // FIX: Redirect unauthenticated users with a contextual message
    if (!user) {
        const loginMessage = encodeURIComponent("Log in to show appreciation for this research.")
        redirect(`/login?message=${loginMessage}`)
    }

    if (type === 'article') {
        const existing = await prisma.articleLike.findUnique({
            where: { articleId_userId: { articleId: targetId, userId: user.id } }
        })
        if (existing) {
            await prisma.articleLike.delete({ where: { id: existing.id } })
        } else {
            await prisma.articleLike.create({ data: { articleId: targetId, userId: user.id } })
        }
    } else {
        const existing = await prisma.socialLike.findUnique({
            where: { socialPostId_userId: { socialPostId: targetId, userId: user.id } }
        })
        if (existing) {
            await prisma.socialLike.delete({ where: { id: existing.id } })
        } else {
            await prisma.socialLike.create({ data: { socialPostId: targetId, userId: user.id } })
        }
    }

    revalidatePath('/blog')
    revalidatePath('/feed')
}