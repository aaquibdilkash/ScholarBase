'use server'

import prisma from '@/lib/db'
import { requireCurrentUser } from '@/lib/auth'
import { readFormValue } from '@/lib/form'
import { revalidatePath } from 'next/cache'
import { notifyMentionedUsers, notifyUserById } from '@/lib/notifications'

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
        const comment = await prisma.articleComment.create({
            data: { content, articleId: targetId, authorId: user.id, parentId },
        })

        const target = parentId
            ? await prisma.articleComment.findUnique({
                where: { id: parentId },
                select: { authorId: true },
            })
            : await prisma.article.findUnique({
                where: { id: targetId },
                select: { authorId: true },
            })

        if (target?.authorId) {
            await notifyUserById({
                recipientId: target.authorId,
                actorId: user.id,
                type: parentId ? 'reply-created' : 'comment-created',
                targetType: 'article',
                targetId: comment.id,
                title: parentId
                    ? `${user.email?.split('@')[0] || 'Someone'} replied to your comment`
                    : `${user.email?.split('@')[0] || 'Someone'} commented on your article`,
                body: content,
            })
        }

        await notifyMentionedUsers({
            actorId: user.id,
            content,
            type: 'mention',
            targetType: 'comment',
            targetId: comment.id,
            titleFactory: (handle) => `@${handle} was mentioned in a comment`,
            bodyFactory: () => content,
        })
    } else {
        const comment = await prisma.socialComment.create({
            data: { content, socialPostId: targetId, authorId: user.id, parentId },
        })

        const target = parentId
            ? await prisma.socialComment.findUnique({
                where: { id: parentId },
                select: { authorId: true },
            })
            : await prisma.socialPost.findUnique({
                where: { id: targetId },
                select: { authorId: true },
            })

        if (target?.authorId) {
            await notifyUserById({
                recipientId: target.authorId,
                actorId: user.id,
                type: parentId ? 'reply-created' : 'comment-created',
                targetType: 'post',
                targetId: comment.id,
                title: parentId
                    ? `${user.email?.split('@')[0] || 'Someone'} replied to your comment`
                    : `${user.email?.split('@')[0] || 'Someone'} commented on your post`,
                body: content,
            })
        }

        await notifyMentionedUsers({
            actorId: user.id,
            content,
            type: 'mention',
            targetType: 'comment',
            targetId: comment.id,
            titleFactory: (handle) => `@${handle} was mentioned in a comment`,
            bodyFactory: () => content,
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

        const isLiked =
            !existing &&
                (await prisma.articleCommentLike.findUnique({
                    where: { commentId_userId: { commentId, userId: user.id } },
                    select: { id: true },
                }))
                ? true
                : !!existing

        // After toggle, compute fresh count
        const likeCount = await prisma.articleCommentLike.count({
            where: { commentId },
        })

        // Normalize isLiked by checking existence after toggle
        const likeExistsAfter = await prisma.articleCommentLike.findUnique({
            where: { commentId_userId: { commentId, userId: user.id } },
            select: { id: true },
        })

        revalidatePath('/blog/[slug]', 'page')
        revalidatePath('/feed/[id]', 'page')
        revalidatePath('/blog')
        revalidatePath('/feed')

        return { isLiked: !!likeExistsAfter, likeCount }
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

        const likeCount = await prisma.socialCommentLike.count({
            where: { commentId },
        })

        const likeExistsAfter = await prisma.socialCommentLike.findUnique({
            where: { commentId_userId: { commentId, userId: user.id } },
            select: { id: true },
        })

        revalidatePath('/blog/[slug]', 'page')
        revalidatePath('/feed/[id]', 'page')
        revalidatePath('/blog')
        revalidatePath('/feed')

        return { isLiked: !!likeExistsAfter, likeCount }
    }
}
