'use server'

import prisma from '@/lib/db'
import { requireCurrentUser } from '@/lib/auth'
import { readFormValue } from '@/lib/form'
import { revalidatePath } from 'next/cache'

export async function createComment(
    formData: FormData,
    targetId: string,
    type: 'article' | 'post',
    parentId?: string
) {
    const user = await requireCurrentUser('Log in to join the academic discussion.')

    const content = readFormValue(formData, 'content')
    if (!content) return

    if (type === 'article') {
        await prisma.articleComment.create({
            data: { content, articleId: targetId, authorId: user.id, parentId },
        })
    } else {
        await prisma.socialComment.create({
            data: { content, socialPostId: targetId, authorId: user.id, parentId },
        })
    }

    revalidatePath('/blog/[slug]')
    revalidatePath('/feed')
}

export async function toggleCommentLike(commentId: string, type: 'article' | 'post') {
    const user = await requireCurrentUser('Log in to react to this discussion.')

    if (type === 'article') {
        const existing = await prisma.articleCommentLike.findUnique({
            where: { commentId_userId: { commentId, userId: user.id } },
        })

        if (existing) {
            await prisma.articleCommentLike.delete({ where: { id: existing.id } })
        } else {
            await prisma.articleCommentLike.create({
                data: { commentId, userId: user.id },
            })
        }
    } else {
        const existing = await prisma.socialCommentLike.findUnique({
            where: { commentId_userId: { commentId, userId: user.id } },
        })

        if (existing) {
            await prisma.socialCommentLike.delete({ where: { id: existing.id } })
        } else {
            await prisma.socialCommentLike.create({
                data: { commentId, userId: user.id },
            })
        }
    }

    revalidatePath('/blog/[slug]', 'page')
    revalidatePath('/feed/[id]', 'page')
    revalidatePath('/blog')
    revalidatePath('/feed')
}