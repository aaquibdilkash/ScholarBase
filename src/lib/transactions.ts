/* eslint-disable @typescript-eslint/no-explicit-any */
// `any` is intentional here: the ENTITY_CONFIG maps each module to a union of
// concrete Prisma delegates, and Prisma 7's strict client types forbid calling
// methods directly on that union. We route through a permissive structural type.
import { VoteType } from '@prisma/client'
import prisma from './db'
import { resolveCommentDeletePermission } from './deletion'
import { isUserAdmin } from './auth'
import type { CommentEntityType } from '@/types/comments'

// Permissive delegate shape.
type AnyDelegate = {
  findUnique: (args: any) => Promise<any>
  findFirst: (args: any) => Promise<any>
  findMany: (args: any) => Promise<any>
  create: (args: any) => Promise<any>
  update: (args: any) => Promise<any>
  delete: (args: any) => Promise<any>
  upsert: (args: any) => Promise<any>
  updateMany: (args: any) => Promise<any>
}

// Transaction options to avoid serverless latency timeouts
export const TRANSACTION_OPTIONS = {
  maxWait: 5000,
  timeout: 15000,
}

// ============================================
// UNIFIED ENTITY CONFIG
// ============================================
export const ENTITY_CONFIG = {
  SOCIAL_POST: {
    model: 'socialPost' as const,
    voteModel: 'socialVote' as const,
    commentModel: 'socialComment' as const,
    commentVoteModel: 'socialCommentVote' as const,
    get parent() { return (prisma as any)[this.model] },
    get vote() { return (prisma as any)[this.voteModel] },
    get comment() { return (prisma as any)[this.commentModel] },
    get commentVote() { return (prisma as any)[this.commentVoteModel] },
    titleField: 'content',
    parentFk: 'socialPostId',
    commentFk: 'socialPostId',
  },
  ARTICLE: {
    model: 'article' as const,
    voteModel: 'articleVote' as const,
    commentModel: 'articleComment' as const,
    commentVoteModel: 'articleCommentVote' as const,
    get parent() { return (prisma as any)[this.model] },
    get vote() { return (prisma as any)[this.voteModel] },
    get comment() { return (prisma as any)[this.commentModel] },
    get commentVote() { return (prisma as any)[this.commentVoteModel] },
    titleField: 'title',
    parentFk: 'articleId',
    commentFk: 'articleId',
  },
  HELP_POST: {
    model: 'helpPost' as const,
    voteModel: 'helpPostVote' as const,
    commentModel: 'helpPostComment' as const,
    commentVoteModel: 'helpPostCommentVote' as const,
    get parent() { return (prisma as any)[this.model] },
    get vote() { return (prisma as any)[this.voteModel] },
    get comment() { return (prisma as any)[this.commentModel] },
    get commentVote() { return (prisma as any)[this.commentVoteModel] },
    titleField: 'title',
    parentFk: 'helpPostId',
    commentFk: 'helpPostId',
  },
  CONTRIBUTION: {
    model: 'contribution' as const,
    voteModel: 'contributionVote' as const,
    commentModel: 'contributionComment' as const,
    commentVoteModel: 'contributionCommentVote' as const,
    get parent() { return (prisma as any)[this.model] },
    get vote() { return (prisma as any)[this.voteModel] },
    get comment() { return (prisma as any)[this.commentModel] },
    get commentVote() { return (prisma as any)[this.commentVoteModel] },
    titleField: 'title',
    parentFk: 'contributionId',
    commentFk: 'contributionId',
  },
  PUBLICATION: {
    model: 'publication' as const,
    voteModel: 'publicationVote' as const,
    commentModel: 'publicationComment' as const,
    commentVoteModel: 'publicationCommentVote' as const,
    get parent() { return (prisma as any)[this.model] },
    get vote() { return (prisma as any)[this.voteModel] },
    get comment() { return (prisma as any)[this.commentModel] },
    get commentVote() { return (prisma as any)[this.commentVoteModel] },
    titleField: 'title',
    parentFk: 'publicationId',
    commentFk: 'publicationId',
  },
  RESEARCH_TOOL: {
    model: 'researchTool' as const,
    voteModel: 'researchToolVote' as const,
    commentModel: 'researchToolComment' as const,
    commentVoteModel: 'researchToolCommentVote' as const,
    get parent() { return (prisma as any)[this.model] },
    get vote() { return (prisma as any)[this.voteModel] },
    get comment() { return (prisma as any)[this.commentModel] },
    get commentVote() { return (prisma as any)[this.commentVoteModel] },
    titleField: 'name',
    parentFk: 'researchToolId',
    commentFk: 'researchToolId',
  },
  RESEARCH_GRANT: {
    model: 'researchGrant' as const,
    voteModel: 'researchGrantVote' as const,
    commentModel: 'researchGrantComment' as const,
    commentVoteModel: 'researchGrantCommentVote' as const,
    get parent() { return (prisma as any)[this.model] },
    get vote() { return (prisma as any)[this.voteModel] },
    get comment() { return (prisma as any)[this.commentModel] },
    get commentVote() { return (prisma as any)[this.commentVoteModel] },
    titleField: 'title',
    parentFk: 'researchGrantId',
    commentFk: 'researchGrantId',
  },
  COURSE: {
    model: 'course' as const,
    voteModel: 'courseVote' as const,
    commentModel: 'courseComment' as const,
    commentVoteModel: 'courseCommentVote' as const,
    get parent() { return (prisma as any)[this.model] },
    get vote() { return (prisma as any)[this.voteModel] },
    get comment() { return (prisma as any)[this.commentModel] },
    get commentVote() { return (prisma as any)[this.commentVoteModel] },
    titleField: 'title',
    parentFk: 'courseId',
    commentFk: 'courseId',
  },
  JOURNAL: {
    model: 'journal' as const,
    voteModel: 'journalVote' as const,
    commentModel: 'journalComment' as const,
    commentVoteModel: 'journalCommentVote' as const,
    get parent() { return (prisma as any)[this.model] },
    get vote() { return (prisma as any)[this.voteModel] },
    get comment() { return (prisma as any)[this.commentModel] },
    get commentVote() { return (prisma as any)[this.commentVoteModel] },
    titleField: 'title',
    parentFk: 'journalId',
    commentFk: 'journalId',
  },
  RESULT: {
    model: 'result' as const,
    voteModel: 'resultVote' as const,
    commentModel: 'resultComment' as const,
    commentVoteModel: 'resultCommentVote' as const,
    get parent() { return (prisma as any)[this.model] },
    get vote() { return (prisma as any)[this.voteModel] },
    get comment() { return (prisma as any)[this.commentModel] },
    get commentVote() { return (prisma as any)[this.commentVoteModel] },
    titleField: 'title',
    parentFk: 'resultId',
    commentFk: 'resultId',
  },
  RESEARCH_SURVEY: {
    model: 'researchSurvey' as const,
    voteModel: 'surveyVote' as const,
    commentModel: 'surveyComment' as const,
    commentVoteModel: 'surveyCommentVote' as const,
    get parent() { return (prisma as any)[this.model] },
    get vote() { return (prisma as any)[this.voteModel] },
    get comment() { return (prisma as any)[this.commentModel] },
    get commentVote() { return (prisma as any)[this.commentVoteModel] },
    titleField: 'title',
    parentFk: 'surveyId',
    commentFk: 'surveyId',
  },
  RESEARCH_EVENT: {
    model: 'researchEvent' as const,
    voteModel: 'researchEventVote' as const,
    commentModel: 'researchEventComment' as const,
    commentVoteModel: 'researchEventCommentVote' as const,
    get parent() { return (prisma as any)[this.model] },
    get vote() { return (prisma as any)[this.voteModel] },
    get comment() { return (prisma as any)[this.commentModel] },
    get commentVote() { return (prisma as any)[this.commentVoteModel] },
    titleField: 'title',
    parentFk: 'researchEventId',
    commentFk: 'researchEventId',
  },
  PHD_ADMISSION: {
    model: 'phdAdmission' as const,
    voteModel: 'phdAdmissionVote' as const,
    commentModel: 'phdAdmissionComment' as const,
    commentVoteModel: 'phdAdmissionCommentVote' as const,
    get parent() { return (prisma as any)[this.model] },
    get vote() { return (prisma as any)[this.voteModel] },
    get comment() { return (prisma as any)[this.commentModel] },
    get commentVote() { return (prisma as any)[this.commentVoteModel] },
    titleField: 'university',
    parentFk: 'phdAdmissionId',
    commentFk: 'phdAdmissionId',
  },
  JOB_VACANCY: {
    model: 'jobVacancy' as const,
    voteModel: 'jobVacancyVote' as const,
    commentModel: 'jobVacancyComment' as const,
    commentVoteModel: 'jobVacancyCommentVote' as const,
    get parent() { return (prisma as any)[this.model] },
    get vote() { return (prisma as any)[this.voteModel] },
    get comment() { return (prisma as any)[this.commentModel] },
    get commentVote() { return (prisma as any)[this.commentVoteModel] },
    titleField: 'title',
    parentFk: 'jobVacancyId',
    commentFk: 'jobVacancyId',
  },
  SUPERVISOR: {
    model: 'supervisor' as const,
    voteModel: 'supervisorVote' as const,
    commentModel: 'supervisorComment' as const,
    commentVoteModel: 'supervisorCommentVote' as const,
    get parent() { return (prisma as any)[this.model] },
    get vote() { return (prisma as any)[this.voteModel] },
    get comment() { return (prisma as any)[this.commentModel] },
    get commentVote() { return (prisma as any)[this.commentVoteModel] },
    titleField: 'name',
    parentFk: 'supervisorId',
    commentFk: 'supervisorId',
  },
  RECOMMENDATION: {
    model: 'recommendation' as const,
    voteModel: 'recommendationVote' as const,
    commentModel: 'recommendationComment' as const,
    commentVoteModel: 'recommendationCommentVote' as const,
    get parent() { return (prisma as any)[this.model] },
    get vote() { return (prisma as any)[this.voteModel] },
    get comment() { return (prisma as any)[this.commentModel] },
    get commentVote() { return (prisma as any)[this.commentVoteModel] },
    titleField: 'feedback',
    parentFk: 'recommendationId',
    commentFk: 'recommendationId',
  },
} as const

export const VOTE_CONFIG = ENTITY_CONFIG
export type ModuleKey = keyof typeof ENTITY_CONFIG

// Helper to resolve delegates dynamically on any client (PrismaClient or TransactionClient)
export function getDelegates(moduleKey: ModuleKey, client: any) {
  const config = ENTITY_CONFIG[moduleKey]
  return {
    parent: client[config.model] as AnyDelegate,
    vote: client[config.voteModel] as AnyDelegate,
    comment: client[config.commentModel] as AnyDelegate,
    commentVote: client[config.commentVoteModel] as AnyDelegate,
    config,
  }
}

const MODULE_VOTE_TARGET_TYPE: Record<ModuleKey, string> = {
  SOCIAL_POST: 'post',
  ARTICLE: 'article',
  HELP_POST: 'help',
  CONTRIBUTION: 'contribution',
  PUBLICATION: 'publication',
  RESEARCH_TOOL: 'researchTool',
  RESEARCH_GRANT: 'researchGrant',
  COURSE: 'course',
  JOURNAL: 'journal',
  RESULT: 'result',
  RESEARCH_SURVEY: 'survey',
  RESEARCH_EVENT: 'event',
  PHD_ADMISSION: 'admission',
  JOB_VACANCY: 'vacancy',
  SUPERVISOR: 'supervisor',
  RECOMMENDATION: 'recommendation',
}

const MODULE_DISPLAY_NAME: Record<ModuleKey, string> = {
  SOCIAL_POST: 'post',
  ARTICLE: 'article',
  HELP_POST: 'help post',
  CONTRIBUTION: 'contribution',
  PUBLICATION: 'publication',
  RESEARCH_TOOL: 'research tool',
  RESEARCH_GRANT: 'research grant',
  COURSE: 'course',
  JOURNAL: 'journal',
  RESULT: 'result',
  RESEARCH_SURVEY: 'survey',
  RESEARCH_EVENT: 'event',
  PHD_ADMISSION: 'admission',
  JOB_VACANCY: 'vacancy',
  SUPERVISOR: 'profile',
  RECOMMENDATION: 'recommendation',
}

const getVoteValue = (current: VoteType | null, next: VoteType): number => {
  if (current === next) return next === 'UPVOTE' ? -1 : 1
  if (current === null) return next === 'UPVOTE' ? 1 : -1
  return next === 'UPVOTE' ? 2 : -2
}

type VoteResult = { totalVotes: number; userVote: VoteType | null }

// ============================================
// FOLLOW TRANSACTION
// ============================================
export async function handleFollowTransaction(followerId: string, followingId: string) {
  return prisma.$transaction(async (tx) => {
    const existingFollow = await tx.follows.findUnique({
      where: { followerId_followingId: { followerId, followingId } },
    })

    if (existingFollow) {
      await tx.follows.delete({
        where: { followerId_followingId: { followerId, followingId } },
      })
      await tx.user.update({
        where: { id: followerId },
        data: { followingCount: { decrement: 1 } },
      })
      await tx.user.update({
        where: { id: followingId },
        data: { followersCount: { decrement: 1 } },
      })
      return { wasFollowing: true }
    }

    await tx.follows.create({ data: { followerId, followingId } })
    await tx.user.update({
      where: { id: followerId },
      data: { followingCount: { increment: 1 } },
    })
    await tx.user.update({
      where: { id: followingId },
      data: { followersCount: { increment: 1 } },
    })
    await tx.userActivity.create({
      data: {
        userId: followerId,
        action: 'FOLLOWED',
        moduleType: 'USER',
        entityId: followingId,
        entityTitle: '',
      },
    })
    return { wasFollowing: false }
  }, TRANSACTION_OPTIONS)
}

// ============================================
// VOTE TRANSACTION (top-level content)
// ============================================
export async function handleVoteTransaction(
  module: string,
  entityId: string,
  userId: string,
  newVote: VoteType,
): Promise<VoteResult> {
  const moduleKey = module as ModuleKey
  const config = ENTITY_CONFIG[moduleKey]
  if (!config) throw new Error(`Invalid module for voting: ${module}`)

  const voteWhere = {
    [`${config.parentFk}_userId`]: { [config.parentFk]: entityId, userId },
  }

  return prisma.$transaction(async (tx) => {
    // Dynamically bind delegates to the transaction context (tx)
    const { parent, vote } = getDelegates(moduleKey, tx)

    const [entity, existingVote] = await Promise.all([
      parent.findUnique({
        where: { id: entityId },
        select: { [config.titleField]: true, totalVotes: true, authorId: true, isFrozen: true },
      }),
      vote.findUnique({ where: voteWhere, select: { voteType: true } }),
    ])

    if (!entity) throw new Error("The content you're trying to vote on does not exist.")
    if (entity.isFrozen) throw new Error('This content is frozen by moderators and cannot be voted on.')

    const currentVote = existingVote?.voteType || null
    const voteValue = getVoteValue(currentVote, newVote)
    const entityTitle = (entity[config.titleField] as string) || 'Untitled'
    let totalVotes = entity.totalVotes

    if (currentVote === newVote) {
      await vote.delete({ where: voteWhere })
      totalVotes = totalVotes + voteValue
    } else {
      await vote.upsert({
        where: voteWhere,
        create: { [config.parentFk]: entityId, userId, voteType: newVote },
        update: { voteType: newVote },
      })
      totalVotes = totalVotes + voteValue
    }

    await parent.update({
      where: { id: entityId },
      data: { totalVotes },
    })

    if (voteValue !== 0 && entity.authorId) {
      await tx.user.update({
        where: { id: entity.authorId },
        data: { reputation: { increment: voteValue } },
      })
    }

    await tx.userActivity.create({
      data: { userId, action: 'VOTED', moduleType: module, entityId, entityTitle },
    })

    if (newVote === 'UPVOTE' && voteValue > 0 && entity.authorId && entity.authorId !== userId) {
      const targetType = MODULE_VOTE_TARGET_TYPE[moduleKey]
      if (targetType) {
        let targetId = entityId
        if (module === 'RECOMMENDATION') {
          const rec = await (tx.recommendation as unknown as AnyDelegate).findUnique({
            where: { id: entityId },
            select: { supervisorId: true },
          })
          if (rec?.supervisorId) {
            targetId = `${rec.supervisorId}/${entityId}`
          }
        }

        const actor = await tx.user.findUnique({
          where: { id: userId },
          select: { name: true, handle: true, email: true },
        })
        const actorName =
          actor?.name || actor?.handle || actor?.email?.split('@')[0] || 'Someone'
        const moduleName = MODULE_DISPLAY_NAME[moduleKey] || 'content'

        await tx.notification.create({
          data: {
            recipientId: entity.authorId,
            actorId: userId,
            type: 'content-upvoted',
            targetType,
            targetId,
            title: `${actorName} upvoted your ${moduleName}`,
            body: entityTitle,
          },
        })
      }
    }

    return { totalVotes, userVote: newVote === currentVote ? null : newVote }
  }, TRANSACTION_OPTIONS)
}

// ============================================
// COMMENT VOTE TRANSACTION
// ============================================
export async function handleCommentVoteTransaction(
  commentId: string,
  userId: string,
  newVote: VoteType,
  commentType: CommentEntityType,
): Promise<{ totalVotes: number; userVote: VoteType | null }> {
  const moduleKey = COMMENT_TYPE_TO_MODULE[commentType]
  if (!moduleKey) throw new Error(`Invalid module for comment voting: ${commentType}`)

  const config = ENTITY_CONFIG[moduleKey]
  const voteWhere = {
    commentId_userId: { commentId, userId },
  }

  return prisma.$transaction(async (tx) => {
    // Dynamically bind delegates to the transaction context (tx)
    const { parent, comment: commentModel, commentVote } = getDelegates(moduleKey, tx)

    const [comment, existingVote] = await Promise.all([
      commentModel.findUnique({
        where: { id: commentId },
        select: { totalVotes: true, [config.commentFk]: true, content: true, authorId: true, isFrozen: true },
      }),
      commentVote.findUnique({ where: voteWhere, select: { voteType: true } }),
    ])

    if (!comment) throw new Error("Comment not found.")
    if (comment.isFrozen) throw new Error("This comment is frozen by moderators and cannot be voted on.")

    // Votes on a comment are also blocked when its parent content is frozen.
    const parentEntity = await parent.findUnique({
      where: { id: (comment as any)[config.commentFk] },
      select: { isFrozen: true },
    })
    if (parentEntity?.isFrozen) throw new Error("This discussion is frozen by moderators and cannot be voted on.")

    const currentVote = existingVote?.voteType || null
    const voteValue = getVoteValue(currentVote, newVote)
    const entityTitle = ((comment as any).content as string) || 'Untitled'
    let totalVotes = comment.totalVotes

    if (currentVote === newVote) {
      await commentVote.delete({ where: voteWhere })
      totalVotes = totalVotes + voteValue
    } else {
      await commentVote.upsert({
        where: voteWhere,
        create: { commentId, userId, voteType: newVote },
        update: { voteType: newVote },
      })
      totalVotes = totalVotes + voteValue
    }

    await commentModel.update({
      where: { id: commentId },
      data: { totalVotes },
    })

    if (voteValue !== 0 && comment.authorId) {
      await tx.user.update({
        where: { id: comment.authorId },
        data: { reputation: { increment: voteValue } },
      })
    }

    await tx.userActivity.create({
      data: {
        userId,
        action: 'VOTED',
        moduleType: `${moduleKey}_COMMENT`,
        entityId: commentId,
        entityTitle: entityTitle.substring(0, 50),
      },
    })

    return { totalVotes, userVote: newVote === currentVote ? null : newVote }
  }, TRANSACTION_OPTIONS)
}

// ============================================
// COMMENT TRANSACTIONS
// ============================================
export async function createCommentTransaction(
  moduleName: ModuleKey,
  entityId: string,
  authorId: string,
  content: string,
  parentId?: string,
  mentions?: { id: string; handle: string | null }[],
) {
  const config = ENTITY_CONFIG[moduleName]
  if (!config) throw new Error(`Invalid module for comments: ${moduleName}`)

  return prisma.$transaction(async (tx) => {
    const { parent, comment: commentModel } = getDelegates(moduleName, tx)

    const parentEntity = await parent.findUnique({
      where: { id: entityId },
      select: { [config.titleField]: true, isFrozen: true },
    })
    if (!parentEntity) throw new Error('Parent entity not found.')
    if ((parentEntity as any).isFrozen) throw new Error('This content is frozen by moderators and cannot be commented on.')
    const entityTitle = (parentEntity as any)[config.titleField] as string

    const createdComment = await commentModel.create({
      data: { content, authorId, [config.parentFk]: entityId, parentId, mentions: mentions ?? undefined },
    })

    await parent.update({
      where: { id: entityId },
      data: { totalComments: { increment: 1 } },
    })

    if (parentId) {
      const parentComment = await commentModel.findUnique({
        where: { id: parentId },
        select: { isFrozen: true, isDeleted: true },
      })
      if (!parentComment || parentComment.isDeleted) throw new Error('The comment you are replying to no longer exists.')
      if (parentComment.isFrozen) throw new Error('This comment is frozen by moderators and cannot be replied to.')

      await commentModel.update({
        where: { id: parentId },
        data: { totalReplies: { increment: 1 } },
      })
    }

    await tx.userActivity.create({
      data: {
        userId: authorId,
        action: parentId ? 'REPLIED' : 'COMMENTED',
        moduleType: moduleName,
        entityId,
        entityTitle,
      },
    })

    const author = await tx.user.findUnique({
      where: { id: authorId },
      select: { id: true, name: true, handle: true, avatarUrl: true },
    })

    return {
      id: (createdComment as any).id,
      content,
      authorId,
      parentId,
      [config.parentFk]: entityId,
      createdAt: (createdComment as any).createdAt,
      totalVotes: 0,
      totalReplies: 0,
      mentions: mentions ?? null,
      author: author ?? null,
    }
  }, TRANSACTION_OPTIONS)
}

export async function deleteCommentTransaction(
  moduleName: ModuleKey,
  commentId: string,
  userId: string,
) {
  const config = ENTITY_CONFIG[moduleName]
  if (!config) throw new Error(`Invalid module for comments: ${moduleName}`)

  // RULE 1 / single-connection pool: resolve the caller's admin status HERE on
  // the global client, BEFORE the interactive transaction opens, so the in-tx
  // permission check can reuse it instead of checking out a SECOND pooled
  // connection mid-transaction (would deadlock under `max: 1` -> Prisma P2028).
  const isAdmin = await isUserAdmin(userId)

  return prisma.$transaction(async (tx) => {
    const { parent, comment: commentModel } = getDelegates(moduleName, tx)

    const comment = await commentModel.findUnique({
      where: { id: commentId },
      select: { authorId: true, parentId: true, isDeleted: true, [config.parentFk]: true, totalVotes: true },
    })

    if (!comment) throw new Error('Comment not found.')
    if ((comment as any).isDeleted) {
      throw new Error('Comment already deleted.')
    }

    const parentEntityId = (comment as any)[config.parentFk] as string
    const rootPost = await parent.findUnique({
      where: { id: parentEntityId },
      select: { authorId: true },
    })
    const parentComment = comment.parentId
      ? await commentModel.findUnique({
          where: { id: (comment as any).parentId as string },
          select: { authorId: true },
        })
      : null

    const deletedByType = await resolveCommentDeletePermission(userId, {
      commentAuthorId: (comment as any).authorId,
      rootPostAuthorId: (rootPost as any)?.authorId ?? null,
      parentCommentAuthorId: (parentComment as any)?.authorId ?? null,
      isReply: (comment as any).parentId !== null,
    }, isAdmin)

    const shouldReverseRep = comment.authorId !== null && comment.totalVotes !== 0

    await commentModel.update({
      where: { id: commentId },
      data: { isDeleted: true, deletedByType, deletedById: userId },
    })

    await parent.update({
      where: { id: parentEntityId },
      data: { totalComments: { decrement: 1 } },
    })

    if (comment.parentId) {
      await commentModel.update({
        where: { id: comment.parentId },
        data: { totalReplies: { decrement: 1 } },
      })
    }

    if (shouldReverseRep) {
      await tx.user.update({
        where: { id: comment.authorId },
        data: { reputation: { decrement: comment.totalVotes } },
      })
    }

    return { wasTombstoned: true, parentId: comment.parentId, deletedByType }
  }, TRANSACTION_OPTIONS)
}

// ============================================
// COMMENT TYPE MAPPING
// ============================================
export const COMMENT_TYPE_TO_MODULE: Record<string, ModuleKey> = {
  post: 'SOCIAL_POST',
  article: 'ARTICLE',
  vacancy: 'JOB_VACANCY',
  admission: 'PHD_ADMISSION',
  event: 'RESEARCH_EVENT',
  supervisor: 'SUPERVISOR',
  recommendation: 'RECOMMENDATION',
  help: 'HELP_POST',
  journal: 'JOURNAL',
  researchTool: 'RESEARCH_TOOL',
  researchGrant: 'RESEARCH_GRANT',
  course: 'COURSE',
  result: 'RESULT',
  contribution: 'CONTRIBUTION',
  publication: 'PUBLICATION',
  survey: 'RESEARCH_SURVEY',
}