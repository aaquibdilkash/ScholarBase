'use server'

import { requireCurrentUser, isAuthorizedOrAdmin } from '@/lib/auth'
import prisma from '@/lib/db'
import { readFormValue } from '@/lib/form'
import { notifyMentionedUsers, notifyUserById } from '@/lib/notifications'
import { updateReputationIncremental, reverseCommentThreadVoteReputation } from '@/app/actions/interactions'
import { CommentType, CommentVoteModel } from '@/types/comments'



export async function createComment(
    formData: FormData,
    targetId: string,
    type: CommentType,
    parentId?: string
) {
    const user = await requireCurrentUser('Log in to join the academic discussion.')

    const content = readFormValue(formData, 'content')
    if (!content) return { success: false, error: 'Content cannot be empty.' }

    const mentionsRaw = readFormValue(formData, 'mentions');
    let mentions: { id: string, handle: string }[] | undefined;
    if (mentionsRaw) {
        try {
            mentions = JSON.parse(mentionsRaw);
        } catch {
            // ignore invalid JSON
        }
    }

    // Fetch actor name for notification titles
    const actor = await prisma.user.findUnique({
        where: { id: user.id },
        select: { name: true, handle: true },
    });
    const actorName = actor?.name || actor?.handle || user.email?.split('@')[0] || 'Someone';

    if (type === 'help') {
        const mentionedUsers = await notifyMentionedUsers({
            actorId: user.id, content, type: 'mention', targetType: type, targetId,
            titleFactory: (handle) => `@${handle} was mentioned in a comment`, bodyFactory: () => content,
            mentions,
        })
        const newComment = await prisma.helpPostComment.create({
            data: { content, helpPostId: targetId, authorId: user.id, parentId, mentions: mentionedUsers },
            include: { author: true, votes: true, replies: { include: { author: true, votes: true, _count: { select: { votes: true } } } }, _count: { select: { votes: true } } },
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
        return { success: true, data: newComment };
    } else if (type === 'article') {
        const article = await prisma.article.findUnique({
            where: { id: targetId },
            select: { slug: true, authorId: true },
        });
        if (!article) return { success: false, error: "Article not found" };

        const mentionedUsers = await notifyMentionedUsers({
            actorId: user.id, content, type: 'mention', targetType: type, targetId: article.slug,
            titleFactory: (handle) => `@${handle} was mentioned in a comment`, bodyFactory: () => content,
            mentions,
        });
        const newComment = await prisma.articleComment.create({
            data: { content, articleId: targetId, authorId: user.id, parentId, mentions: mentionedUsers },
            include: { author: true, votes: true, replies: { include: { author: true, votes: true, _count: { select: { votes: true } } } }, _count: { select: { votes: true } } },
        });
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
        return { success: true, data: newComment };
    } else if (type === 'post') {
        const mentionedUsers = await notifyMentionedUsers({
            actorId: user.id, content, type: 'mention', targetType: type, targetId,
            titleFactory: (handle) => `@${handle} was mentioned in a comment`, bodyFactory: () => content,
            mentions,
        })
        const newComment = await prisma.socialComment.create({
            data: { content, socialPostId: targetId, authorId: user.id, parentId, mentions: mentionedUsers },
            include: { author: true, votes: true, replies: { include: { author: true, votes: true, _count: { select: { votes: true } } } }, _count: { select: { votes: true } } },
        })
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
        return { success: true, data: newComment };
    } else if (type === 'event') {
        const mentionedUsers = await notifyMentionedUsers({
            actorId: user.id, content, type: 'mention', targetType: type, targetId,
            titleFactory: (handle) => `@${handle} was mentioned in a comment`, bodyFactory: () => content,
            mentions,
        })
        const newComment = await prisma.researchEventComment.create({
            data: { content, researchEventId: targetId, authorId: user.id, parentId, mentions: mentionedUsers },
            include: { author: true, votes: true, replies: { include: { author: true, votes: true, _count: { select: { votes: true } } } }, _count: { select: { votes: true } } },
        })
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
        return { success: true, data: newComment };
    } else if (type === 'vacancy') {
        const mentionedUsers = await notifyMentionedUsers({
            actorId: user.id, content, type: 'mention', targetType: type, targetId,
            titleFactory: (handle) => `@${handle} was mentioned in a comment`, bodyFactory: () => content,
            mentions,
        })
        const newComment = await prisma.jobVacancyComment.create({
            data: { content, jobVacancyId: targetId, authorId: user.id, parentId, mentions: mentionedUsers },
            include: { author: true, votes: true, replies: { include: { author: true, votes: true, _count: { select: { votes: true } } } }, _count: { select: { votes: true } } },
        })
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
        return { success: true, data: newComment };
    } else if (type === 'admission') {
        const mentionedUsers = await notifyMentionedUsers({
            actorId: user.id, content, type: 'mention', targetType: type, targetId,
            titleFactory: (handle) => `@${handle} was mentioned in a comment`, bodyFactory: () => content,
            mentions,
        })
        const newComment = await prisma.phdAdmissionComment.create({
            data: { content, phdAdmissionId: targetId, authorId: user.id, parentId, mentions: mentionedUsers },
            include: { author: true, votes: true, replies: { include: { author: true, votes: true, _count: { select: { votes: true } } } }, _count: { select: { votes: true } } },
        })
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
        return { success: true, data: newComment };
    } else if (type === 'supervisor') {
        const mentionedUsers = await notifyMentionedUsers({
            actorId: user.id, content, type: 'mention', targetType: type, targetId,
            titleFactory: (handle) => `@${handle} was mentioned in a comment`, bodyFactory: () => content,
            mentions,
        })
        const newComment = await prisma.supervisorComment.create({
            data: { content, supervisorId: targetId, authorId: user.id, parentId, mentions: mentionedUsers },
            include: { author: true, votes: true, replies: { include: { author: true, votes: true, _count: { select: { votes: true } } } }, _count: { select: { votes: true } } },
        })
        return { success: true, data: newComment };
    } else if (type === 'recommendation') {
        const mentionedUsers = await notifyMentionedUsers({
            actorId: user.id, content, type: 'mention', targetType: type, targetId,
            titleFactory: (handle) => `@${handle} was mentioned in a comment`, bodyFactory: () => content,
            mentions,
        })
        const newComment = await prisma.recommendationComment.create({
            data: { content, recommendationId: targetId, authorId: user.id, parentId, mentions: mentionedUsers },
            include: { author: true, votes: true, replies: { include: { author: true, votes: true, _count: { select: { votes: true } } } }, _count: { select: { votes: true } } },
        })
        const recommendation = await prisma.recommendation.findUnique({
            where: { id: targetId },
            select: { supervisorId: true, authorId: true }
        });
        const target = parentId
            ? await prisma.recommendationComment.findUnique({ where: { id: parentId }, select: { authorId: true } })
            : recommendation
        if (target?.authorId && recommendation) {
            await notifyUserById({
                recipientId: target.authorId, actorId: user.id,
                type: parentId ? 'reply-created' : 'comment-created',
                targetType: 'recommendation',
                targetId: `${recommendation.supervisorId}/${targetId}`,
                title: parentId ? `${actorName} replied to your comment` : `${actorName} commented on your recommendation`,
                body: content,
            })
        }
        return { success: true, data: newComment };
    } else if (type === 'journal') {
        const mentionedUsers = await notifyMentionedUsers({
            actorId: user.id, content, type: 'mention', targetType: type, targetId,
            titleFactory: (handle) => `@${handle} was mentioned in a comment`, bodyFactory: () => content,
            mentions,
        })
        const newComment = await prisma.journalComment.create({
            data: { content, journalId: targetId, authorId: user.id, parentId, mentions: mentionedUsers },
            include: { author: true, votes: true, replies: { include: { author: true, votes: true, _count: { select: { votes: true } } } }, _count: { select: { votes: true } } },
        })
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
        return { success: true, data: newComment };
    } else if (type === 'researchTool') {
        const mentionedUsers = await notifyMentionedUsers({
            actorId: user.id, content, type: 'mention', targetType: type, targetId,
            titleFactory: (handle) => `@${handle} was mentioned in a comment`, bodyFactory: () => content,
            mentions,
        })
        const newComment = await prisma.researchToolComment.create({
            data: { content, researchToolId: targetId, authorId: user.id, parentId, mentions: mentionedUsers },
            include: { author: true, votes: true, replies: { include: { author: true, votes: true, _count: { select: { votes: true } } } }, _count: { select: { votes: true } } },
        })
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
        return { success: true, data: newComment };
    } else if (type === 'researchGrant') {
        const mentionedUsers = await notifyMentionedUsers({
            actorId: user.id, content, type: 'mention', targetType: type, targetId,
            titleFactory: (handle) => `@${handle} was mentioned in a comment`, bodyFactory: () => content,
            mentions,
        })
        const newComment = await prisma.researchGrantComment.create({
            data: { content, researchGrantId: targetId, authorId: user.id, parentId, mentions: mentionedUsers },
            include: { author: true, votes: true, replies: { include: { author: true, votes: true, _count: { select: { votes: true } } } }, _count: { select: { votes: true } } },
        })
        const target = parentId
            ? await prisma.researchGrantComment.findUnique({ where: { id: parentId }, select: { authorId: true } })
            : await prisma.researchGrant.findUnique({ where: { id: targetId }, select: { authorId: true } })
        if (target?.authorId) {
            await notifyUserById({
                recipientId: target.authorId, actorId: user.id,
                type: parentId ? 'reply-created' : 'comment-created',
                targetType: 'researchGrant', targetId,
                title: parentId ? `${actorName} replied to your comment` : `${actorName} commented on your research grant`,
                body: content,
            })
        }
        return { success: true, data: newComment };
    } else if (type === 'course') {
        const mentionedUsers = await notifyMentionedUsers({
            actorId: user.id, content, type: 'mention', targetType: type, targetId,
            titleFactory: (handle) => `@${handle} was mentioned in a comment`, bodyFactory: () => content,
            mentions,
        })
        const newComment = await prisma.courseComment.create({
            data: { content, courseId: targetId, authorId: user.id, parentId, mentions: mentionedUsers },
            include: { author: true, votes: true, replies: { include: { author: true, votes: true, _count: { select: { votes: true } } } }, _count: { select: { votes: true } } },
        })
        const target = parentId
            ? await prisma.courseComment.findUnique({ where: { id: parentId }, select: { authorId: true } })
            : await prisma.course.findUnique({ where: { id: targetId }, select: { authorId: true } })
        if (target?.authorId) {
            await notifyUserById({
                recipientId: target.authorId, actorId: user.id,
                type: parentId ? 'reply-created' : 'comment-created',
                targetType: 'course', targetId,
                title: parentId ? `${actorName} replied to your comment` : `${actorName} commented on your course`,
                body: content,
            })
        }
        return { success: true, data: newComment };
    } else if (type === 'result') {
        const mentionedUsers = await notifyMentionedUsers({
            actorId: user.id, content, type: 'mention', targetType: type, targetId,
            titleFactory: (handle) => `@${handle} was mentioned in a comment`, bodyFactory: () => content,
            mentions,
        })
        const newComment = await prisma.resultComment.create({
            data: { content, resultId: targetId, authorId: user.id, parentId, mentions: mentionedUsers },
            include: { author: true, votes: true, replies: { include: { author: true, votes: true, _count: { select: { votes: true } } } }, _count: { select: { votes: true } } },
        })
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
        return { success: true, data: newComment };
    } else if (type === 'contribution') {
        const mentionedUsers = await notifyMentionedUsers({
            actorId: user.id, content, type: 'mention', targetType: type, targetId,
            titleFactory: (handle) => `@${handle} was mentioned in a comment`, bodyFactory: () => content,
            mentions,
        })
        const newComment = await prisma.contributionComment.create({
            data: { content, contributionId: targetId, authorId: user.id, parentId, mentions: mentionedUsers },
            include: { author: true, votes: true, replies: { include: { author: true, votes: true, _count: { select: { votes: true } } } }, _count: { select: { votes: true } } },
        })
        const target = parentId
            ? await prisma.contributionComment.findUnique({ where: { id: parentId }, select: { authorId: true } })
            : await prisma.contribution.findUnique({ where: { id: targetId }, select: { authorId: true } })
        if (target?.authorId) {
            await notifyUserById({
                recipientId: target.authorId, actorId: user.id,
                type: parentId ? 'reply-created' : 'comment-created',
                targetType: 'contribution', targetId,
                title: parentId ? `${actorName} replied to your comment` : `${actorName} commented on your contribution`,
                body: content,
            })
        }
        return { success: true, data: newComment };
    } else if (type === 'publication') {
        const mentionedUsers = await notifyMentionedUsers({
            actorId: user.id, content, type: 'mention', targetType: type, targetId,
            titleFactory: (handle) => `@${handle} was mentioned in a comment`, bodyFactory: () => content,
            mentions,
        })
        const newComment = await prisma.publicationComment.create({
            data: { content, publicationId: targetId, authorId: user.id, parentId, mentions: mentionedUsers },
            include: { author: true, votes: true, replies: { include: { author: true, votes: true, _count: { select: { votes: true } } } }, _count: { select: { votes: true } } },
        })
        const target = parentId
            ? await prisma.publicationComment.findUnique({ where: { id: parentId }, select: { authorId: true } })
            : await prisma.publication.findUnique({ where: { id: targetId }, select: { authorId: true } })
        if (target?.authorId) {
            await notifyUserById({
                recipientId: target.authorId, actorId: user.id,
                type: parentId ? 'reply-created' : 'comment-created',
                targetType: 'publication', targetId,
                title: parentId ? `${actorName} replied to your comment` : `${actorName} commented on your publication`,
                body: content,
            })
        }
        return { success: true, data: newComment };
    } else if (type === 'survey') {
        const mentionedUsers = await notifyMentionedUsers({
            actorId: user.id, content, type: 'mention', targetType: type, targetId,
            titleFactory: (handle) => `@${handle} was mentioned in a comment`, bodyFactory: () => content,
            mentions,
        })
        const newComment = await prisma.surveyComment.create({
            data: { content, surveyId: targetId, authorId: user.id, parentId, mentions: mentionedUsers },
            include: { author: true, votes: true, replies: { include: { author: true, votes: true, _count: { select: { votes: true } } } }, _count: { select: { votes: true } } },
        })
        const target = parentId
            ? await prisma.surveyComment.findUnique({ where: { id: parentId }, select: { authorId: true } })
            : await prisma.researchSurvey.findUnique({ where: { id: targetId }, select: { authorId: true } })
        if (target?.authorId) {
            await notifyUserById({
                recipientId: target.authorId, actorId: user.id,
                type: parentId ? 'reply-created' : 'comment-created',
                targetType: 'survey', targetId,
                title: parentId ? `${actorName} replied to your comment` : `${actorName} commented on your survey`,
                body: content,
            })
        }
        return { success: true, data: newComment };
    }

    return { success: false, error: 'Invalid comment type' };
}

import type { CommentActionConfig } from '@/types/comments';

export async function editComment(formData: FormData, commentId: string, type: CommentType) {
    const user = await requireCurrentUser('Log in to edit this comment.')
    const content = readFormValue(formData, 'content')
    if (!content) return

    const mentionsRaw = readFormValue(formData, 'mentions');
    let mentions: { id: string, handle: string }[] | undefined;
    if (mentionsRaw) {
        try {
            mentions = JSON.parse(mentionsRaw);
        } catch {
            // ignore invalid JSON
        }
    }

    const editMap: Record<string, CommentActionConfig> = {
        article: { model: prisma.articleComment },
        post: { model: prisma.socialComment },
        event: { model: prisma.researchEventComment },
        vacancy: { model: prisma.jobVacancyComment },
        admission: { model: prisma.phdAdmissionComment },
        supervisor: { model: prisma.supervisorComment },
        recommendation: { model: prisma.recommendationComment },
        help: { model: prisma.helpPostComment },
        journal: { model: prisma.journalComment },
        researchTool: { model: prisma.researchToolComment },
        researchGrant: { model: prisma.researchGrantComment },
        course: { model: prisma.courseComment },
        result: { model: prisma.resultComment },
        contribution: { model: prisma.contributionComment },
        publication: { model: prisma.publicationComment },
        survey: { model: prisma.surveyComment },
    }
    const cfg = editMap[type]
    if (!cfg) return

    const comment = await cfg.model.findUnique({ where: { id: commentId }, select: { authorId: true } })
    if (!comment) throw new Error('Not found.')
    if (!await isAuthorizedOrAdmin(comment.authorId, user.id)) throw new Error('Not authorized.')
    await cfg.model.update({ where: { id: commentId }, data: { content, mentions } })
    // REMOVED: All revalidatePath calls - client cache updated via React Query
    return { success: true, data: { id: commentId } }
}

export async function deleteComment(commentId: string, type: CommentType) {
    const user = await requireCurrentUser('Log in to delete this comment.')

    const delMap: Record<string, CommentActionConfig> = {
        article: { model: prisma.articleComment },
        post: { model: prisma.socialComment },
        event: { model: prisma.researchEventComment },
        vacancy: { model: prisma.jobVacancyComment },
        admission: { model: prisma.phdAdmissionComment },
        supervisor: { model: prisma.supervisorComment },
        recommendation: { model: prisma.recommendationComment },
        help: { model: prisma.helpPostComment },
        journal: { model: prisma.journalComment },
        researchTool: { model: prisma.researchToolComment },
        researchGrant: { model: prisma.researchGrantComment },
        course: { model: prisma.courseComment },
        result: { model: prisma.resultComment },
        contribution: { model: prisma.contributionComment },
        publication: { model: prisma.publicationComment },
        survey: { model: prisma.surveyComment },
    }
    const cfg = delMap[type]
    if (!cfg) return

    const comment = await cfg.model.findUnique({ where: { id: commentId }, select: { authorId: true, parentId: true } })
    if (!comment) throw new Error('Not found.')
    if (!await isAuthorizedOrAdmin(comment.authorId, user.id)) throw new Error('Not authorized.')

    // One recursive aggregate reverses votes on this comment and every reply
    // that will be removed by the cascading delete.
    await reverseCommentThreadVoteReputation(type, commentId);

    await cfg.model.delete({ where: { id: commentId } })
    // REMOVED: All revalidatePath calls - client cache updated via React Query
    return { success: true, data: { id: commentId, parentId: comment.parentId } }
}

// --- Vote System ---

const COMMENT_VOTE_MODEL: Record<string, CommentVoteModel> = {
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
    researchGrant: prisma.researchGrantCommentVote,
    course: prisma.courseCommentVote,
    result: prisma.resultCommentVote,
    contribution: prisma.contributionCommentVote,
    publication: prisma.publicationCommentVote,
    survey: prisma.surveyCommentVote,
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
    researchGrant: (id) => prisma.researchGrantComment.findUnique({ where: { id }, select: { authorId: true } }).then(r => r?.authorId ?? null),
    course: (id) => prisma.courseComment.findUnique({ where: { id }, select: { authorId: true } }).then(r => r?.authorId ?? null),
    result: (id) => prisma.resultComment.findUnique({ where: { id }, select: { authorId: true } }).then(r => r?.authorId ?? null),
    contribution: (id) => prisma.contributionComment.findUnique({ where: { id }, select: { authorId: true } }).then(r => r?.authorId ?? null),
    publication: (id) => prisma.publicationComment.findUnique({ where: { id }, select: { authorId: true } }).then(r => r?.authorId ?? null),
    survey: (id) => prisma.surveyComment.findUnique({ where: { id }, select: { authorId: true } }).then(r => r?.authorId ?? null),
}

export async function toggleCommentVote(
    commentId: string,
    type: CommentType,
    voteType: 'UPVOTE' | 'DOWNVOTE',
): Promise<{ userVote: 'UPVOTE' | 'DOWNVOTE' | null; upvotes: number; downvotes: number } | { error: string }> {
    let user;
    try {
        user = await requireCurrentUser('Log in to react to this discussion.');
    } catch {
        return { error: "UNAUTHORIZED" };
    }
    const model = COMMENT_VOTE_MODEL[type]
    if (!model) throw new Error(`Unknown comment type: ${type}`)

    // Capture previous vote state before mutating
    const existing = await model.findUnique({
        where: { commentId_userId: { commentId, userId: user.id } },
    })
    const previousVoteType: 'UPVOTE' | 'DOWNVOTE' | null = existing?.voteType ?? null

    let finalVoteType: 'UPVOTE' | 'DOWNVOTE' | null = voteType
    if (existing) {
        if (existing.voteType === voteType) {
            await model.delete({ where: { id: existing.id } })
            finalVoteType = null
        } else {
            await model.update({ where: { id: existing.id }, data: { voteType } })
            finalVoteType = voteType
        }
    } else {
        await model.create({ data: { commentId, userId: user.id, voteType } })
        finalVoteType = voteType
    }

    const [upvotes, downvotes] = await Promise.all([
        model.count({ where: { commentId, voteType: 'UPVOTE' } }),
        model.count({ where: { commentId, voteType: 'DOWNVOTE' } }),
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
        admission: '/admissions/[id]', supervisor: '/supervisor/[id]', recommendation: '/supervisor/[id]/recommendation/[id]',
        help: '/help/[id]', journal: '/journals/[id]', researchTool: '/research-tools/[id]', researchGrant: '/grants/[id]', course: '/learn/[id]', result: '/results/[id]', contribution: '/contributions/[id]', publication: '/publications/[id]', survey: '/surveys/[id]',
    }
    const path = revalidateMap[type]
    if (path) {
        if (type === 'recommendation') {
            const recommendationComment = await prisma.recommendationComment.findUnique({
                where: { id: commentId },
                select: { recommendation: { select: { id: true, supervisorId: true } } }
            });
            if (recommendationComment?.recommendation) {
                // REMOVED: revalidatePath
            }
        } else if (path.includes('[id]')) {
            // REMOVED: revalidatePath
        } else {
            // REMOVED: revalidatePath
        }
    }

    // Also revalidate author profile
    if (commentAuthorId) {
        // REMOVED: revalidatePath
    }

    return { userVote: finalVoteType, upvotes, downvotes }
}
