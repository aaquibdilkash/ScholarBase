'use server'

import prisma from '@/lib/db'
import { requireCurrentUser } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { notifyUserById } from '@/lib/notifications'

export async function toggleLike(targetId: string, type: 'article' | 'post'): Promise<boolean> {
    const user = await requireCurrentUser('Log in to show appreciation for this research.')

    let isLiked = false;

    if (type === 'article') {
        const existing = await prisma.articleLike.findUnique({
            where: { articleId_userId: { articleId: targetId, userId: user.id } },
        })
        if (existing) {
            await prisma.articleLike.delete({ where: { id: existing.id } })
            isLiked = false
        } else {
            await prisma.articleLike.create({ data: { articleId: targetId, userId: user.id } })
            isLiked = true
            const article = await prisma.article.findUnique({
                where: { id: targetId },
                select: { authorId: true, title: true },
            })

            if (article?.authorId) {
                await notifyUserById({
                    recipientId: article.authorId,
                    actorId: user.id,
                    type: 'article-liked',
                    targetType: 'article',
                    targetId,
                    title: `${user.email?.split('@')[0] || 'Someone'} liked your article`,
                    body: article.title,
                })
            }
        }
    } else {
        const existing = await prisma.socialLike.findUnique({
            where: { socialPostId_userId: { socialPostId: targetId, userId: user.id } },
        })
        if (existing) {
            await prisma.socialLike.delete({ where: { id: existing.id } })
            isLiked = false
        } else {
            await prisma.socialLike.create({ data: { socialPostId: targetId, userId: user.id } })
            isLiked = true
            const post = await prisma.socialPost.findUnique({
                where: { id: targetId },
                select: { authorId: true, content: true },
            })

            if (post?.authorId) {
                await notifyUserById({
                    recipientId: post.authorId,
                    actorId: user.id,
                    type: 'post-liked',
                    targetType: 'post',
                    targetId,
                    title: `${user.email?.split('@')[0] || 'Someone'} liked your post`,
                    body: post.content.slice(0, 120),
                })
            }
        }
    }

    revalidatePath('/blog')
    revalidatePath('/feed')

    return isLiked
}