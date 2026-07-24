'use server'

import { requireCurrentUser } from '@/lib/auth'
import prisma from '@/lib/db'
import { readFormValue } from '@/lib/form'
import { revalidatePath } from 'next/cache'
import { notifyMentionedUsers, notifyUserById } from '@/lib/notifications'
import { updateReputationIncremental } from '@/app/actions/interactions'



type CommentType = 'article' | 'post' | 'vacancy' | 'admission' | 'event' | 'supervisor' | 'recommendation' | 'help' | 'journal' | 'researchTool' | 'result';

export async function createComment(
    formData: FormData,
    targetId: string,
    type: CommentType,
    parentId?: string
) {
    const user = await requireCurrentUser('Log in to join the academic discussion.')

    const content = readFormValue(formData, 'content')
    if (!content) return

    // Fetch actor name for notification titles
    const actor = await prisma.user.findUnique({
        where: { id: user.id },
        select: { name: true, handle: true },
    });
    const actorName = actor?.name || actor?.handle || user.email?.split('@')[0] || 'Someone';

    if (type === 'help') {
        await prisma.helpPostComment.create({
            data: { content, helpPostId: targetId, authorId: user.id, parentId },
        })
        const target = parentId
            ? await prisma.helpPostComment.findUnique({ where: { id: parentId }, select: { authorId: true } })
            : await prisma.helpPost.findUnique({ where: { id: targetId }, select: { authorId: true } })
        if (target?.authorId) {
            await notifyUserById({
                recipientId: target.authorId, actorId: user.id,
                type: parentId ? 'reply-created' : 'comment-created',
                targetType: 'help', targetId,
                title: parentId ? `${actorName} replied to your comment` : `${actorName} commented on your help post`,
                body: content,
            })
        }
        await notifyMentionedUsers({
            actorId: user.id, content, type: 'mention', targetType: 'comment', targetId,
            titleFactory: (handle) => `@${handle} was mentioned in a comment`, bodyFactory: () => content,
        })
        revalidatePath(`/help/${targetId}`)
    } else if (type === 'article') {
        await prisma.articleComment.create({ data: { content, articleId: targetId, authorId: user.id, parentId } });
        const article = await prisma.article.findUnique({ where: { id: targetId }, select: { slug: true, authorId: true } });
        if (!article) return
        const target = parentId
            ? await prisma.articleComment.findUnique({ where: { id: parentId }, select: { authorId: true } })
            : article;
        if (target?.authorId) {
            await notifyUserById({
                recipientId: target.authorId, actorId: user.id,
                type: parentId ? "reply-created" : "comment-created",
                targetType: "article", targetId: article.slug,
                title: parentId ? `${actorName} replied to your comment` : `${actorName} commented on your article`,
                body: content,
            });
        }
        await notifyMentionedUsers({
            actorId: user.id, content, type: 'mention', targetType: 'comment', targetId: article.slug,
            titleFactory: (handle) => `@${handle} was mentioned in a comment`, bodyFactory: () => content,
        });
        revalidatePath('/blog/[slug]', 'page')
    } else if (type === 'post') {
        await prisma.socialComment.create({ data: { content, socialPostId: targetId, authorId: user.id, parentId } })
        const target = parentId
            ? await prisma.socialComment.findUnique({ where: { id: parentId }, select: { authorId: true } })
            : await prisma.socialPost.findUnique({ where: { id: targetId }, select: { authorId: true } })
        if (target?.authorId) {
            await notifyUserById({
                recipientId: target.authorId, actorId: user.id,
                type: parentId ? 'reply-created' : 'comment-created',
                targetType: 'post', targetId,
                title: parentId ? `${actorName} replied to your comment` : `${actorName} commented on your post`,
                body: content,
            })
        }
        await notifyMentionedUsers({
            actorId: user.id, content, type: 'mention', targetType: 'comment', targetId,
            titleFactory: (handle) => `@${handle} was mentioned in a comment`, bodyFactory: () => content,
        })
        revalidatePath('/feed')
        revalidatePath(`/feed/${targetId}`)
    } else if (type === 'event') {
        await prisma.researchEventComment.create({ data: { content, researchEventId: targetId, authorId: user.id, parentId } })
        const target = parentId
            ? await prisma.researchEventComment.findUnique({ where: { id: parentId }, select: { authorId: true } })
            : await prisma.researchEvent.findUnique({ where: { id: targetId }, select: { authorId: true } })
        if (target?.authorId) {
            await notifyUserById({
                recipientId: target.authorId, actorId: user.id,
                type: parentId ? 'reply-created' : 'comment-created',
                targetType: 'event', targetId,
                title: parentId ? `${actorName} replied to your comment` : `${actorName} commented on your event`,
                body: content,
            })
        }
        await notifyMentionedUsers({
            actorId: user.id, content, type: 'mention', targetType: 'comment', targetId,
            titleFactory: (handle) => `@${handle} was mentioned in a comment`, bodyFactory: () => content,
        })
        revalidatePath(`/events/${targetId}`)
    } else if (type === 'vacancy') {
        await prisma.jobVacancyComment.create({ data: { content, jobVacancyId: targetId, authorId: user.id, parentId } })
        const target = parentId
            ? await prisma.jobVacancyComment.findUnique({ where: { id: parentId }, select: { authorId: true } })
            : await prisma.jobVacancy.findUnique({ where: { id: targetId }, select: { authorId: true } })
        if (target?.authorId) {
            await notifyUserById({
                recipientId: target.authorId, actorId: user.id,
                type: parentId ? 'reply-created' : 'comment-created',
                targetType: 'vacancy', targetId,
                title: parentId ? `${actorName} replied to your comment` : `${actorName} commented on your vacancy`,
                body: content,
            })
        }
        await notifyMentionedUsers({
            actorId: user.id, content, type: 'mention', targetType: 'comment', targetId,
            titleFactory: (handle) => `@${handle} was mentioned in a comment`, bodyFactory: () => content,
        })
        revalidatePath(`/vacancies/${targetId}`)
    } else if (type === 'admission') {
        await prisma.phdAdmissionComment.create({ data: { content, phdAdmissionId: targetId, authorId: user.id, parentId } })
        const target = parentId
            ? await prisma.phdAdmissionComment.findUnique({ where: { id: parentId }, select: { authorId: true } })
            : await prisma.phdAdmission.findUnique({ where: { id: targetId }, select: { authorId: true } })
        if (target?.authorId) {
            await notifyUserById({
                recipientId: target.authorId, actorId: user.id,
                type: parentId ? 'reply-created' : 'comment-created',
                targetType: 'admission', targetId,
                title: parentId ? `${actorName} replied to your comment` : `${actorName} commented on your admission post`,
                body: content,
            })
        }
        await notifyMentionedUsers({
            actorId: user.id, content, type: 'mention', targetType: 'comment', targetId,
            titleFactory: (handle) => `@${handle} was mentioned in a comment`, bodyFactory: () => content,
        })
        revalidatePath(`/admissions/${targetId}`)
    } else if (type === 'supervisor') {
        await prisma.supervisorComment.create({ data: { content, supervisorId: targetId, authorId: user.id, parentId } })
        revalidatePath(`/supervisor/${targetId}`)
    } else if (type === 'recommendation') {
        await prisma.recommendationComment.create({ data: { content, recommendationId: targetId, authorId: user.id, parentId } })
        const target = parentId
            ? await prisma.recommendationComment.findUnique({ where: { id: parentId }, select: { authorId: true } })
            : await prisma.recommendation.findUnique({ where: { id: targetId }, select: { authorId: true } })
        if (target?.authorId) {
            await notifyUserById({
                recipientId: target.authorId, actorId: user.id,
                type: parentId ? 'reply-created' : 'comment-created',
                targetType: 'recommendation', targetId,
                title: parentId ? `${actorName} replied to your comment` : `${actorName} commented on your recommendation`,
                body: content,
            })
        }
        await notifyMentionedUsers({
            actorId: user.id, content, type: 'mention', targetType: 'comment', targetId,
            titleFactory: (handle) => `@${handle} was mentioned in a comment`, bodyFactory: () => content,
        })
        revalidatePath(`/recommendation/${targetId}`)
    } else if (type === 'journal') {
        await prisma.journalComment.create({ data: { content, journalId: targetId, authorId: user.id, parentId } })
        const target = parentId
            ? await prisma.journalComment.findUnique({ where: { id: parentId }, select: { authorId: true } })
            : await prisma.journal.findUnique({ where: { id: targetId }, select: { authorId: true } })
        if (target?.authorId) {
            await notifyUserById({
                recipientId: target.authorId, actorId: user.id,
                type: parentId ? 'reply-created' : 'comment-created',
                targetType: 'journal', targetId,
                title: parentId ? `${actorName} replied to your comment` : `${actorName} commented on your journal post`,
                body: content,
            })
        }
        await notifyMentionedUsers({
            actorId: user.id, content, type: 'mention', targetType: 'comment', targetId,
            titleFactory: (handle) => `@${handle} was mentioned in a comment`, bodyFactory: () => content,
        })
        revalidatePath(`/journals/${targetId}`)
    } else if (type === 'researchTool') {
        await prisma.researchToolComment.create({ data: { content, researchToolId: targetId, authorId: user.id, parentId } })
        const target = parentId
            ? await prisma.researchToolComment.findUnique({ where: { id: parentId }, select: { authorId: true } })
            : await prisma.researchTool.findUnique({ where: { id: targetId }, select: { authorId: true } })
        if (target?.authorId) {
            await notifyUserById({
                recipientId: target.authorId, actorId: user.id,
                type: parentId ? 'reply-created' : 'comment-created',
                targetType: 'researchTool', targetId,
                title: parentId ? `${actorName} replied to your comment` : `${actorName} commented on your research tool`,
                body: content,
            })
        }
        await notifyMentionedUsers({
            actorId: user.id, content, type: 'mention', targetType: 'comment', targetId,
            titleFactory: (handle) => `@${handle} was mentioned in a comment`, bodyFactory: () => content,
        })
        revalidatePath(`/research-tools/${targetId}`)
    } else if (type === 'result') {
        await prisma.resultComment.create({ data: { content, resultId: targetId, authorId: user.id, parentId } })
        const target = parentId
            ? await prisma.resultComment.findUnique({ where: { id: parentId }, select: { authorId: true } })
            : await prisma.result.findUnique({ where: { id: targetId }, select: { authorId: true } })
        if (target?.authorId) {
            await notifyUserById({
                recipientId: target.authorId, actorId: user.id,
                type: parentId ? 'reply-created' : 'comment-created',
                targetType: 'result', targetId,
                title: parentId ? `${actorName} replied to your comment` : `${actorName} commented on your result posting`,
                body: content,
            })
        }
        await notifyMentionedUsers({
            actorId: user.id, content, type: 'mention', targetType: 'comment', targetId,
            titleFactory: (handle) => `@${handle} was mentioned in a comment`, bodyFactory: () => content,
        })
        revalidatePath(`/results/${targetId}`)
    }
}

export async function editComment(formData: FormData, commentId: string, type: CommentType) {
    const user = await requireCurrentUser('Log in to edit this comment.')
    const content = readFormValue(formData, 'content')
    if (!content) return

    const editMap: Record<string, any> = {
        article: { model: prisma.articleComment, revalidate: '/blog/[slug]' },
        post: { model: prisma.socialComment, revalidate: '/feed' },
        event: { model: prisma.researchEventComment, revalidate: '/events/[id]' },
        vacancy: { model: prisma.jobVacancyComment, revalidate: '/vacancies/[id]' },
        admission: { model: prisma.phdAdmissionComment, revalidate: '/admissions/[id]' },
        supervisor: { model: prisma.supervisorComment, revalidate: '/supervisor/[id]' },
        recommendation: { model: prisma.recommendationComment, revalidate: '/recommendation/[id]' },
        help: { model: prisma.helpPostComment, revalidate: '/help/[id]' },
        journal: { model: prisma.journalComment, revalidate: '/journals/[id]' },
        researchTool: { model: prisma.researchToolComment, revalidate: '/research-tools/[id]' },
        result: { model: prisma.resultComment, revalidate: '/results/[id]' },
    }
    const cfg = editMap[type]
    if (!cfg) return

    const comment = await (cfg.model as any).findUnique({ where: { id: commentId }, select: { authorId: true } })
    if (!comment || comment.authorId !== user.id) throw new Error('Not authorized.')
    await (cfg.model as any).update({ where: { id: commentId }, data: { content } })
    if (cfg.revalidate.includes('[id]')) revalidatePath(cfg.revalidate, 'page' as any)
    else revalidatePath(cfg.revalidate)
}

export async function deleteComment(commentId: string, type: CommentType) {
    const user = await requireCurrentUser('Log in to delete this comment.')

    const delMap: Record<string, any> = {
        article: { model: prisma.articleComment, revalidate: '/blog/[slug]' },
        post: { model: prisma.socialComment, revalidate: '/feed' },
        event: { model: prisma.researchEventComment, revalidate: '/events/[id]' },
        vacancy: { model: prisma.jobVacancyComment, revalidate: '/vacancies/[id]' },
        admission: { model: prisma.phdAdmissionComment, revalidate: '/admissions/[id]' },
        supervisor: { model: prisma.supervisorComment, revalidate: '/supervisor/[id]' },
        recommendation: { model: prisma.recommendationComment, revalidate: '/recommendation/[id]' },
        help: { model: prisma.helpPostComment, revalidate: '/help/[id]' },
        journal: { model: prisma.journalComment, revalidate: '/journals/[id]' },
        researchTool: { model: prisma.researchToolComment, revalidate: '/research-tools/[id]' },
        result: { model: prisma.resultComment, revalidate: '/results/[id]' },
    }
    const cfg = delMap[type]
    if (!cfg) return

    const comment = await (cfg.model as any).findUnique({ where: { id: commentId }, select: { authorId: true } })
    if (!comment || comment.authorId !== user.id) throw new Error('Not authorized.')
    await (cfg.model as any).delete({ where: { id: commentId } })
    if (cfg.revalidate.includes('[id]')) revalidatePath(cfg.revalidate, 'page' as any)
    else revalidatePath(cfg.revalidate)
}

// --- Vote System ---

const COMMENT_VOTE_MODEL: Record<string, any> = {
    article: prisma.articleCommentVote,
    post: prisma.socialCommentVote,
    event: prisma.researchEventCommentVote,
    vacancy: prisma.jobVacancyCommentVote,
    admission: prisma.phdAdmissionCommentVote,
    supervisor: prisma.supervisorCommentVote,
    recommendation: prisma.recommendationCommentVote,
    help: prisma.helpPostCommentVote,
    journal: prisma.journalCommentVote,
    researchTool: prisma.researchToolCommentVote,
    result: prisma.resultCommentVote,
}

const COMMENT_AUTHOR_FETCH: Record<string, (id: string) => Promise<string | null>> = {
    article: (id) => prisma.articleComment.findUnique({ where: { id }, select: { authorId: true } }).then(r => r?.authorId ?? null),
    post: (id) => prisma.socialComment.findUnique({ where: { id }, select: { authorId: true } }).then(r => r?.authorId ?? null),
    event: (id) => prisma.researchEventComment.findUnique({ where: { id }, select: { authorId: true } }).then(r => r?.authorId ?? null),
    vacancy: (id) => prisma.jobVacancyComment.findUnique({ where: { id }, select: { authorId: true } }).then(r => r?.authorId ?? null),
    admission: (id) => prisma.phdAdmissionComment.findUnique({ where: { id }, select: { authorId: true } }).then(r => r?.authorId ?? null),
    supervisor: (id) => prisma.supervisorComment.findUnique({ where: { id }, select: { authorId: true } }).then(r => r?.authorId ?? null),
    recommendation: (id) => prisma.recommendationComment.findUnique({ where: { id }, select: { authorId: true } }).then(r => r?.authorId ?? null),
    help: (id) => prisma.helpPostComment.findUnique({ where: { id }, select: { authorId: true } }).then(r => r?.authorId ?? null),
    journal: (id) => prisma.journalComment.findUnique({ where: { id }, select: { authorId: true } }).then(r => r?.authorId ?? null),
    researchTool: (id) => prisma.researchToolComment.findUnique({ where: { id }, select: { authorId: true } }).then(r => r?.authorId ?? null),
    result: (id) => prisma.resultComment.findUnique({ where: { id }, select: { authorId: true } }).then(r => r?.authorId ?? null),
}

export async function toggleCommentVote(
    commentId: string,
    type: CommentType,
    voteType: 'UPVOTE' | 'DOWNVOTE',
): Promise<{ userVote: 'UPVOTE' | 'DOWNVOTE' | null; upvotes: number; downvotes: number }> {
    const user = await requireCurrentUser('Log in to react to this discussion.')
    const model = COMMENT_VOTE_MODEL[type]
    if (!model) throw new Error(`Unknown comment type: ${type}`)

    // Capture previous vote state before mutating
    const existing = await (model as any).findUnique({
        where: { commentId_userId: { commentId, userId: user.id } },
    })
    const previousVoteType: 'UPVOTE' | 'DOWNVOTE' | null = existing?.voteType ?? null

    let finalVoteType: 'UPVOTE' | 'DOWNVOTE' | null = voteType
    if (existing) {
        if (existing.voteType === voteType) {
            await (model as any).delete({ where: { id: existing.id } })
            finalVoteType = null
        } else {
            await (model as any).update({ where: { id: existing.id }, data: { voteType } })
            finalVoteType = voteType
        }
    } else {
        await (model as any).create({ data: { commentId, userId: user.id, voteType } })
        finalVoteType = voteType
    }

    const [upvotes, downvotes] = await Promise.all([
        (model as any).count({ where: { commentId, voteType: 'UPVOTE' } }),
        (model as any).count({ where: { commentId, voteType: 'DOWNVOTE' } }),
    ])

    // 🔥 Accurate incremental reputation update (1 query instead of 23+)
    const commentAuthorId = await COMMENT_AUTHOR_FETCH[type]?.(commentId)
    if (commentAuthorId) {
        // Compute the net reputation delta based on actual vote change
        let voteDelta = 0;
        if (previousVoteType === voteType) {
            // Removing vote (toggle off): reverse the previous vote's effect
            voteDelta = voteType === 'UPVOTE' ? -1 : 1;
        } else if (previousVoteType === null) {
            // New vote
            voteDelta = voteType === 'UPVOTE' ? 1 : -1;
        } else {
            // Switching vote (prev is opposite direction): net ±2
            voteDelta = voteType === 'UPVOTE' ? 2 : -2;
        }

        await updateReputationIncremental(commentAuthorId, voteDelta);
    }

    const revalidateMap: Record<string, string> = {
        article: '/blog/[slug]', post: '/feed', event: '/events/[id]', vacancy: '/vacancies/[id]',
        admission: '/admissions/[id]', supervisor: '/supervisor/[id]', recommendation: '/recommendation/[id]',
        help: '/help/[id]', journal: '/journals/[id]', researchTool: '/research-tools/[id]', result: '/results/[id]',
    }
    const path = revalidateMap[type]
    if (path) {
        if (path.includes('[id]')) revalidatePath(path, 'page' as any)
        else revalidatePath(path)
    }

    // Also revalidate author profile
    if (commentAuthorId) {
        revalidatePath(`/scholar/${commentAuthorId}`)
    }

    return { userVote: finalVoteType, upvotes, downvotes }
}
