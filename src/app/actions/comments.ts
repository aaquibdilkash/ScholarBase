'use server'

import prisma from '@/lib/db'
import { requireCurrentUser } from '@/lib/auth'
import { readFormValue } from '@/lib/form'
import { revalidatePath } from 'next/cache'
import { notifyMentionedUsers, notifyUserById } from '@/lib/notifications'

type CommentType = 'article' | 'post' | 'vacancy' | 'admission' | 'event' | 'supervisor' | 'recommendation' | 'help' | 'journal' | 'researchTool';

export async function createComment(
    formData: FormData,
    targetId: string,
    type: CommentType,
    parentId?: string
) {
    const user = await requireCurrentUser('Log in to join the academic discussion.')

    const content = readFormValue(formData, 'content')
    if (!content) return

    if (type === 'help') {
        const comment = await prisma.helpPostComment.create({
            data: { content, helpPostId: targetId, authorId: user.id, parentId },
        })

        const target = parentId
            ? await prisma.helpPostComment.findUnique({ where: { id: parentId }, select: { authorId: true } })
            : await prisma.helpPost.findUnique({ where: { id: targetId }, select: { authorId: true } })

        if (target?.authorId) {
            await notifyUserById({
                recipientId: target.authorId,
                actorId: user.id,
                type: parentId ? 'reply-created' : 'comment-created',
                targetType: 'help',
                targetId: comment.id,
                title: parentId ? `Someone replied to your comment` : `Someone commented on your help post`,
                body: content,
            })
        }

        await notifyMentionedUsers({
            actorId: user.id, content, type: 'mention', targetType: 'comment', targetId: comment.id,
            titleFactory: (handle) => `@${handle} was mentioned in a comment`, bodyFactory: () => content,
        })
        
        revalidatePath(`/help/${targetId}`)
    }

    else if (type === 'article') {
        const comment = await prisma.articleComment.create({
            data: { content, articleId: targetId, authorId: user.id, parentId },
        })

        const target = parentId
            ? await prisma.articleComment.findUnique({ where: { id: parentId }, select: { authorId: true } })
            : await prisma.article.findUnique({ where: { id: targetId }, select: { authorId: true } })

        if (target?.authorId) {
            await notifyUserById({
                recipientId: target.authorId,
                actorId: user.id,
                type: parentId ? 'reply-created' : 'comment-created',
                targetType: 'article',
                targetId: comment.id,
                title: parentId ? `Someone replied to your comment` : `Someone commented on your article`,
                body: content,
            })
        }

        await notifyMentionedUsers({
            actorId: user.id, content, type: 'mention', targetType: 'comment', targetId: comment.id,
            titleFactory: (handle) => `@${handle} was mentioned in a comment`, bodyFactory: () => content,
        })
        
        // Target ID for articles is UUID, but route uses slug. Clearing the article layout is safest here.
        revalidatePath('/blog/[slug]', 'page')
    }

    else if (type === 'post') {
        const comment = await prisma.socialComment.create({
            data: { content, socialPostId: targetId, authorId: user.id, parentId },
        })

        const target = parentId
            ? await prisma.socialComment.findUnique({ where: { id: parentId }, select: { authorId: true } })
            : await prisma.socialPost.findUnique({ where: { id: targetId }, select: { authorId: true } })

        if (target?.authorId) {
            await notifyUserById({
                recipientId: target.authorId,
                actorId: user.id,
                type: parentId ? 'reply-created' : 'comment-created',
                targetType: 'post',
                targetId: comment.id,
                title: parentId ? `Someone replied to your comment` : `Someone commented on your post`,
                body: content,
            })
        }

        await notifyMentionedUsers({
            actorId: user.id, content, type: 'mention', targetType: 'comment', targetId: comment.id,
            titleFactory: (handle) => `@${handle} was mentioned in a comment`, bodyFactory: () => content,
        })
        
        revalidatePath('/feed')
        revalidatePath(`/feed/${targetId}`)
    }

    else if (type === 'event') {
        const comment = await prisma.researchEventComment.create({
            data: { content, researchEventId: targetId, authorId: user.id, parentId },
        })

        const target = parentId
            ? await prisma.researchEventComment.findUnique({ where: { id: parentId }, select: { authorId: true } })
            : await prisma.researchEvent.findUnique({ where: { id: targetId }, select: { authorId: true } })

        if (target?.authorId) {
            await notifyUserById({
                recipientId: target.authorId,
                actorId: user.id,
                type: parentId ? 'reply-created' : 'comment-created',
                targetType: 'event',
                targetId: comment.id,
                title: parentId ? `Someone replied to your comment` : `Someone commented on your event`,
                body: content,
            })
        }

        await notifyMentionedUsers({
            actorId: user.id, content, type: 'mention', targetType: 'comment', targetId: comment.id,
            titleFactory: (handle) => `@${handle} was mentioned in a comment`, bodyFactory: () => content,
        })
        
        revalidatePath(`/events/${targetId}`)
    }

    else if (type === 'vacancy') {
        const comment = await prisma.jobVacancyComment.create({
            data: { content, jobVacancyId: targetId, authorId: user.id, parentId },
        })

        const target = parentId
            ? await prisma.jobVacancyComment.findUnique({ where: { id: parentId }, select: { authorId: true } })
            : await prisma.jobVacancy.findUnique({ where: { id: targetId }, select: { authorId: true } })

        if (target?.authorId) {
            await notifyUserById({
                recipientId: target.authorId,
                actorId: user.id,
                type: parentId ? 'reply-created' : 'comment-created',
                targetType: 'vacancy',
                targetId: comment.id,
                title: parentId ? `Someone replied to your comment` : `Someone commented on your vacancy`,
                body: content,
            })
        }

        await notifyMentionedUsers({
            actorId: user.id, content, type: 'mention', targetType: 'comment', targetId: comment.id,
            titleFactory: (handle) => `@${handle} was mentioned in a comment`, bodyFactory: () => content,
        })
        
        revalidatePath(`/vacancies/${targetId}`)
    }

    else if (type === 'admission') {
        const comment = await prisma.phdAdmissionComment.create({
            data: { content, phdAdmissionId: targetId, authorId: user.id, parentId },
        })

        const target = parentId
            ? await prisma.phdAdmissionComment.findUnique({ where: { id: parentId }, select: { authorId: true } })
            : await prisma.phdAdmission.findUnique({ where: { id: targetId }, select: { authorId: true } })

        if (target?.authorId) {
            await notifyUserById({
                recipientId: target.authorId,
                actorId: user.id,
                type: parentId ? 'reply-created' : 'comment-created',
                targetType: 'admission',
                targetId: comment.id,
                title: parentId ? `Someone replied to your comment` : `Someone commented on your admission post`,
                body: content,
            })
        }

        await notifyMentionedUsers({
            actorId: user.id, content, type: 'mention', targetType: 'comment', targetId: comment.id,
            titleFactory: (handle) => `@${handle} was mentioned in a comment`, bodyFactory: () => content,
        })
        
        revalidatePath(`/admissions/${targetId}`)
    }

    else if (type === 'supervisor') {
        const comment = await prisma.supervisorComment.create({
            data: { content, supervisorId: targetId, authorId: user.id, parentId },
        })
        
        revalidatePath(`/supervisor/${targetId}`)
    }

    else if (type === 'recommendation') {
        const comment = await prisma.recommendationComment.create({
            data: { content, recommendationId: targetId, authorId: user.id, parentId },
        })

        const target = parentId
            ? await prisma.recommendationComment.findUnique({ where: { id: parentId }, select: { authorId: true } })
            : await prisma.recommendation.findUnique({ where: { id: targetId }, select: { authorId: true } })

        if (target?.authorId) {
            await notifyUserById({
                recipientId: target.authorId,
                actorId: user.id,
                type: parentId ? 'reply-created' : 'comment-created',
                targetType: 'recommendation',
                targetId: comment.id,
                title: parentId ? `Someone replied to your comment` : `Someone commented on your recommendation`,
                body: content,
            })
        }

        await notifyMentionedUsers({
            actorId: user.id, content, type: 'mention', targetType: 'comment', targetId: comment.id,
            titleFactory: (handle) => `@${handle} was mentioned in a comment`, bodyFactory: () => content,
        })
        
        revalidatePath(`/recommendation/${targetId}`)
    }

    else if (type === 'journal') {
        const comment = await prisma.journalComment.create({
            data: { content, journalId: targetId, authorId: user.id, parentId },
        })

        const target = parentId
            ? await prisma.journalComment.findUnique({ where: { id: parentId }, select: { authorId: true } })
            : await prisma.journal.findUnique({ where: { id: targetId }, select: { authorId: true } })

        if (target?.authorId) {
            await notifyUserById({
                recipientId: target.authorId,
                actorId: user.id,
                type: parentId ? 'reply-created' : 'comment-created',
                targetType: 'journal',
                targetId: comment.id,
                title: parentId ? `Someone replied to your comment` : `Someone commented on your journal post`,
                body: content,
            })
        }

        await notifyMentionedUsers({
            actorId: user.id, content, type: 'mention', targetType: 'comment', targetId: comment.id,
            titleFactory: (handle) => `@${handle} was mentioned in a comment`, bodyFactory: () => content,
        })
        
        revalidatePath(`/journals/${targetId}`)
    }

    else if (type === 'researchTool') {
        const comment = await prisma.researchToolComment.create({
            data: { content, researchToolId: targetId, authorId: user.id, parentId },
        })

        const target = parentId
            ? await prisma.researchToolComment.findUnique({ where: { id: parentId }, select: { authorId: true } })
            : await prisma.researchTool.findUnique({ where: { id: targetId }, select: { authorId: true } })

        if (target?.authorId) {
            await notifyUserById({
                recipientId: target.authorId,
                actorId: user.id,
                type: parentId ? 'reply-created' : 'comment-created',
                targetType: 'researchTool',
                targetId: comment.id,
                title: parentId ? `Someone replied to your comment` : `Someone commented on your research tool`,
                body: content,
            })
        }

        await notifyMentionedUsers({
            actorId: user.id, content, type: 'mention', targetType: 'comment', targetId: comment.id,
            titleFactory: (handle) => `@${handle} was mentioned in a comment`, bodyFactory: () => content,
        })
        
        revalidatePath(`/research-tools/${targetId}`)
    }
}

export async function toggleCommentLike(commentId: string, type: CommentType) {
    const user = await requireCurrentUser('Log in to react to this discussion.')

    if (type === 'article') {
        const existing = await prisma.articleCommentLike.findUnique({
            where: { commentId_userId: { commentId, userId: user.id } },
        })

        if (existing) await prisma.articleCommentLike.delete({ where: { id: existing.id } })
        else await prisma.articleCommentLike.create({ data: { commentId, userId: user.id } })

        const likeCount = await prisma.articleCommentLike.count({ where: { commentId } })
        const likeExistsAfter = await prisma.articleCommentLike.findUnique({
            where: { commentId_userId: { commentId, userId: user.id } }, select: { id: true },
        })
        revalidatePath('/blog/[slug]', 'page')
        return { isLiked: !!likeExistsAfter, likeCount }
    }

    else if (type === 'post') {
        const existing = await prisma.socialCommentLike.findUnique({
            where: { commentId_userId: { commentId, userId: user.id } },
        })

        if (existing) await prisma.socialCommentLike.delete({ where: { id: existing.id } })
        else await prisma.socialCommentLike.create({ data: { commentId, userId: user.id } })

        const likeCount = await prisma.socialCommentLike.count({ where: { commentId } })
        const likeExistsAfter = await prisma.socialCommentLike.findUnique({
            where: { commentId_userId: { commentId, userId: user.id } }, select: { id: true },
        })
        revalidatePath('/feed')
        return { isLiked: !!likeExistsAfter, likeCount }
    }

    else if (type === 'event') {
        const existing = await prisma.researchEventCommentLike.findUnique({
            where: { commentId_userId: { commentId, userId: user.id } },
        })

        if (existing) await prisma.researchEventCommentLike.delete({ where: { id: existing.id } })
        else await prisma.researchEventCommentLike.create({ data: { commentId, userId: user.id } })

        const likeCount = await prisma.researchEventCommentLike.count({ where: { commentId } })
        const likeExistsAfter = await prisma.researchEventCommentLike.findUnique({
            where: { commentId_userId: { commentId, userId: user.id } }, select: { id: true },
        })
        revalidatePath('/events/[id]', 'page')
        return { isLiked: !!likeExistsAfter, likeCount }
    }

    else if (type === 'vacancy') {
        const existing = await prisma.jobVacancyCommentLike.findUnique({
            where: { commentId_userId: { commentId, userId: user.id } },
        })

        if (existing) await prisma.jobVacancyCommentLike.delete({ where: { id: existing.id } })
        else await prisma.jobVacancyCommentLike.create({ data: { commentId, userId: user.id } })

        const likeCount = await prisma.jobVacancyCommentLike.count({ where: { commentId } })
        const likeExistsAfter = await prisma.jobVacancyCommentLike.findUnique({
            where: { commentId_userId: { commentId, userId: user.id } }, select: { id: true },
        })
        revalidatePath('/vacancies/[id]', 'page')
        return { isLiked: !!likeExistsAfter, likeCount }
    }

    else if (type === 'admission') {
        const existing = await prisma.phdAdmissionCommentLike.findUnique({
            where: { commentId_userId: { commentId, userId: user.id } },
        })

        if (existing) await prisma.phdAdmissionCommentLike.delete({ where: { id: existing.id } })
        else await prisma.phdAdmissionCommentLike.create({ data: { commentId, userId: user.id } })

        const likeCount = await prisma.phdAdmissionCommentLike.count({ where: { commentId } })
        const likeExistsAfter = await prisma.phdAdmissionCommentLike.findUnique({
            where: { commentId_userId: { commentId, userId: user.id } }, select: { id: true },
        })
        revalidatePath('/admissions/[id]', 'page')
        return { isLiked: !!likeExistsAfter, likeCount }
    }

    else if (type === 'supervisor') {
        const existing = await prisma.supervisorCommentLike.findUnique({
            where: { commentId_userId: { commentId, userId: user.id } },
        })

        if (existing) await prisma.supervisorCommentLike.delete({ where: { id: existing.id } })
        else await prisma.supervisorCommentLike.create({ data: { commentId, userId: user.id } })

        const likeCount = await prisma.supervisorCommentLike.count({ where: { commentId } })
        const likeExistsAfter = await prisma.supervisorCommentLike.findUnique({
            where: { commentId_userId: { commentId, userId: user.id } }, select: { id: true },
        })
        revalidatePath('/supervisor/[id]', 'page')
        return { isLiked: !!likeExistsAfter, likeCount }
    }

    else if (type === 'recommendation') {
        const existing = await prisma.recommendationCommentLike.findUnique({
            where: { commentId_userId: { commentId, userId: user.id } },
        })

        if (existing) await prisma.recommendationCommentLike.delete({ where: { id: existing.id } })
        else await prisma.recommendationCommentLike.create({ data: { commentId, userId: user.id } })

        const likeCount = await prisma.recommendationCommentLike.count({ where: { commentId } })
        const likeExistsAfter = await prisma.recommendationCommentLike.findUnique({
            where: { commentId_userId: { commentId, userId: user.id } }, select: { id: true },
        })
        revalidatePath('/recommendation/[id]', 'page')
        return { isLiked: !!likeExistsAfter, likeCount }
    }

    else if (type === 'help') {
        const existing = await prisma.helpPostCommentLike.findUnique({
            where: { commentId_userId: { commentId, userId: user.id } },
        })

        if (existing) await prisma.helpPostCommentLike.delete({ where: { id: existing.id } })
        else await prisma.helpPostCommentLike.create({ data: { commentId, userId: user.id } })

        const likeCount = await prisma.helpPostCommentLike.count({ where: { commentId } })
        const likeExistsAfter = await prisma.helpPostCommentLike.findUnique({
            where: { commentId_userId: { commentId, userId: user.id } }, select: { id: true },
        })
        revalidatePath('/help/[id]', 'page')
        return { isLiked: !!likeExistsAfter, likeCount }
    }

    else if (type === 'journal') {
        const existing = await prisma.journalCommentLike.findUnique({
            where: { commentId_userId: { commentId, userId: user.id } },
        })

        if (existing) await prisma.journalCommentLike.delete({ where: { id: existing.id } })
        else await prisma.journalCommentLike.create({ data: { commentId, userId: user.id } })

        const likeCount = await prisma.journalCommentLike.count({ where: { commentId } })
        const likeExistsAfter = await prisma.journalCommentLike.findUnique({
            where: { commentId_userId: { commentId, userId: user.id } }, select: { id: true },
        })
        revalidatePath('/journals/[id]', 'page')
        return { isLiked: !!likeExistsAfter, likeCount }
    }

    else if (type === 'researchTool') {
        const existing = await prisma.researchToolCommentLike.findUnique({
            where: { commentId_userId: { commentId, userId: user.id } },
        })

        if (existing) await prisma.researchToolCommentLike.delete({ where: { id: existing.id } })
        else await prisma.researchToolCommentLike.create({ data: { commentId, userId: user.id } })

        const likeCount = await prisma.researchToolCommentLike.count({ where: { commentId } })
        const likeExistsAfter = await prisma.researchToolCommentLike.findUnique({
            where: { commentId_userId: { commentId, userId: user.id } }, select: { id: true },
        })
        revalidatePath('/research-tools/[id]', 'page')
        return { isLiked: !!likeExistsAfter, likeCount }
    }

    return { isLiked: false, likeCount: 0 }
}