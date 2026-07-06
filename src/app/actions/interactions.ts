'use server'

import prisma from '@/lib/db'
import { requireCurrentUser } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

export async function toggleLike(targetId: string, type: 'article' | 'post') {
    const user = await requireCurrentUser('Log in to show appreciation for this research.')

    if (type === 'article') {
        const existing = await prisma.articleLike.findUnique({
            where: { articleId_userId: { articleId: targetId, userId: user.id } },
        })
        if (existing) {
            await prisma.articleLike.delete({ where: { id: existing.id } })
        } else {
            await prisma.articleLike.create({ data: { articleId: targetId, userId: user.id } })
        }
    } else {
        const existing = await prisma.socialLike.findUnique({
            where: { socialPostId_userId: { socialPostId: targetId, userId: user.id } },
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