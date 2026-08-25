/* eslint-disable @typescript-eslint/no-explicit-any */
// `any` is intentional here: the ENTITY_CONFIG maps each module to a union of
// concrete Prisma delegates, and Prisma 7's strict client types forbid calling
// methods directly on that union. We route through a permissive structural type.
import { VoteType } from '@prisma/client'
import prisma from './db'
import { isUserAdmin } from '@/lib/auth'
import type { CommentEntityType } from '@/types/comments'

// Permissive delegate shape. The config maps each module to a union of concrete
// Prisma delegates; calling methods directly on that union is not allowed in
// Prisma 7's strict client types, so we cast through this structural type.
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

// ============================================
// UNIFIED ENTITY CONFIG
// ============================================
// Maps uppercase module type keys to their Prisma delegates, foreign-key field
// names, and the field used as the entity "title" for activity logging.
// Both top-level content and nested comments are covered here so that all
// transaction paths share a single source of truth.

export const ENTITY_CONFIG = {
  SOCIAL_POST: {
    parent: prisma.socialPost,
    vote: prisma.socialVote,
    comment: prisma.socialComment,
    commentVote: prisma.socialCommentVote,
    titleField: 'content',
    parentFk: 'socialPostId',
    commentFk: 'socialPostId',
  },
  ARTICLE: {
    parent: prisma.article,
    vote: prisma.articleVote,
    comment: prisma.articleComment,
    commentVote: prisma.articleCommentVote,
    titleField: 'title',
    parentFk: 'articleId',
    commentFk: 'articleId',
  },
  HELP_POST: {
    parent: prisma.helpPost,
    vote: prisma.helpPostVote,
    comment: prisma.helpPostComment,
    commentVote: prisma.helpPostCommentVote,
    titleField: 'title',
    parentFk: 'helpPostId',
    commentFk: 'helpPostId',
  },
  CONTRIBUTION: {
    parent: prisma.contribution,
    vote: prisma.contributionVote,
    comment: prisma.contributionComment,
    commentVote: prisma.contributionCommentVote,
    titleField: 'title',
    parentFk: 'contributionId',
    commentFk: 'contributionId',
  },
  PUBLICATION: {
    parent: prisma.publication,
    vote: prisma.publicationVote,
    comment: prisma.publicationComment,
    commentVote: prisma.publicationCommentVote,
    titleField: 'title',
    parentFk: 'publicationId',
    commentFk: 'publicationId',
  },
  RESEARCH_TOOL: {
    parent: prisma.researchTool,
    vote: prisma.researchToolVote,
    comment: prisma.researchToolComment,
    commentVote: prisma.researchToolCommentVote,
    titleField: 'name',
    parentFk: 'researchToolId',
    commentFk: 'researchToolId',
  },
  RESEARCH_GRANT: {
    parent: prisma.researchGrant,
    vote: prisma.researchGrantVote,
    comment: prisma.researchGrantComment,
    commentVote: prisma.researchGrantCommentVote,
    titleField: 'title',
    parentFk: 'researchGrantId',
    commentFk: 'researchGrantId',
  },
  COURSE: {
    parent: prisma.course,
    vote: prisma.courseVote,
    comment: prisma.courseComment,
    commentVote: prisma.courseCommentVote,
    titleField: 'title',
    parentFk: 'courseId',
    commentFk: 'courseId',
  },
  JOURNAL: {
    parent: prisma.journal,
    vote: prisma.journalVote,
    comment: prisma.journalComment,
    commentVote: prisma.journalCommentVote,
    titleField: 'title',
    parentFk: 'journalId',
    commentFk: 'journalId',
  },
  RESULT: {
    parent: prisma.result,
    vote: prisma.resultVote,
    comment: prisma.resultComment,
    commentVote: prisma.resultCommentVote,
    titleField: 'title',
    parentFk: 'resultId',
    commentFk: 'resultId',
  },
  RESEARCH_SURVEY: {
    parent: prisma.researchSurvey,
    vote: prisma.surveyVote,
    comment: prisma.surveyComment,
    commentVote: prisma.surveyCommentVote,
    titleField: 'title',
    parentFk: 'surveyId',
    commentFk: 'surveyId',
  },
  RESEARCH_EVENT: {
    parent: prisma.researchEvent,
    vote: prisma.researchEventVote,
    comment: prisma.researchEventComment,
    commentVote: prisma.researchEventCommentVote,
    titleField: 'title',
    parentFk: 'researchEventId',
    commentFk: 'researchEventId',
  },
  PHD_ADMISSION: {
    parent: prisma.phdAdmission,
    vote: prisma.phdAdmissionVote,
    comment: prisma.phdAdmissionComment,
    commentVote: prisma.phdAdmissionCommentVote,
    titleField: 'university',
    parentFk: 'phdAdmissionId',
    commentFk: 'phdAdmissionId',
  },
  JOB_VACANCY: {
    parent: prisma.jobVacancy,
    vote: prisma.jobVacancyVote,
    comment: prisma.jobVacancyComment,
    commentVote: prisma.jobVacancyCommentVote,
    titleField: 'title',
    parentFk: 'jobVacancyId',
    commentFk: 'jobVacancyId',
  },
  SUPERVISOR: {
    parent: prisma.supervisor,
    vote: prisma.supervisorVote,
    comment: prisma.supervisorComment,
    commentVote: prisma.supervisorCommentVote,
    titleField: 'name',
    parentFk: 'supervisorId',
    commentFk: 'supervisorId',
  },
  RECOMMENDATION: {
    parent: prisma.recommendation,
    vote: prisma.recommendationVote,
    comment: prisma.recommendationComment,
    commentVote: prisma.recommendationCommentVote,
    titleField: 'feedback',
    parentFk: 'recommendationId',
    commentFk: 'recommendationId',
  },
} as const

// Backwards-compatible alias used by VoteButton / CommentSection / CLI components
export const VOTE_CONFIG = ENTITY_CONFIG

export type ModuleKey = keyof typeof ENTITY_CONFIG

const MODULE_VOTE_NOTIFICATION: Record<ModuleKey, { type: string; targetType: string }> = {
  SOCIAL_POST: { type: 'post-upvoted', targetType: 'post' },
  ARTICLE: { type: 'article-upvoted', targetType: 'article' },
  HELP_POST: { type: 'help-post-upvoted', targetType: 'help' },
  CONTRIBUTION: { type: 'contribution-upvoted', targetType: 'contribution' },
  PUBLICATION: { type: 'publication-upvoted', targetType: 'publication' },
  RESEARCH_TOOL: { type: 'research-tool-upvoted', targetType: 'researchTool' },
  RESEARCH_GRANT: { type: 'research-grant-upvoted', targetType: 'researchGrant' },
  COURSE: { type: 'course-upvoted', targetType: 'course' },
  JOURNAL: { type: 'journal-upvoted', targetType: 'journal' },
  RESULT: { type: 'result-upvoted', targetType: 'result' },
  RESEARCH_SURVEY: { type: 'survey-upvoted', targetType: 'survey' },
  RESEARCH_EVENT: { type: 'event-upvoted', targetType: 'event' },
  PHD_ADMISSION: { type: 'admission-upvoted', targetType: 'admission' },
  JOB_VACANCY: { type: 'vacancy-upvoted', targetType: 'vacancy' },
  SUPERVISOR: { type: 'supervisor-upvoted', targetType: 'supervisor' },
  RECOMMENDATION: { type: 'recommendation-upvoted', targetType: 'recommendation' },
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
  return prisma.$transaction(async (prisma) => {
    const existingFollow = await prisma.follows.findUnique({
      where: { followerId_followingId: { followerId, followingId } },
    })

    if (existingFollow) {
      await prisma.follows.delete({
        where: { followerId_followingId: { followerId, followingId } },
      })
      await prisma.user.update({
        where: { id: followerId },
        data: { followingCount: { decrement: 1 } },
      })
      await prisma.user.update({
        where: { id: followingId },
        data: { followersCount: { decrement: 1 } },
      })
      return { wasFollowing: true }
    }

    await prisma.follows.create({ data: { followerId, followingId } })
    await prisma.user.update({
      where: { id: followerId },
      data: { followingCount: { increment: 1 } },
    })
    await prisma.user.update({
      where: { id: followingId },
      data: { followersCount: { increment: 1 } },
    })
    await prisma.userActivity.create({
      data: {
        userId: followerId,
        action: 'FOLLOWED',
        moduleType: 'USER',
        entityId: followingId,
        entityTitle: '',
      },
    })
    return { wasFollowing: false }
  })
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
  const config = ENTITY_CONFIG[module as ModuleKey]
  if (!config) throw new Error(`Invalid module for voting: ${module}`)

  const parent = config.parent as unknown as AnyDelegate
  const vote = config.vote as unknown as AnyDelegate

  const voteWhere = {
    [`${config.parentFk}_userId`]: { [config.parentFk]: entityId, userId },
  }

  return prisma.$transaction(async (prisma) => {
    const [entity, existingVote] = await Promise.all([
      parent.findUnique({
        where: { id: entityId },
        select: { [config.titleField]: true, totalVotes: true, authorId: true },
      }),
      vote.findUnique({ where: voteWhere, select: { voteType: true } }),
    ])

    if (!entity) throw new Error("The content you're trying to vote on does not exist.")

    const currentVote = existingVote?.voteType || null
    const voteValue = getVoteValue(currentVote, newVote)
    const entityTitle = entity[config.titleField] as string || 'Untitled'
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
      await prisma.user.update({
        where: { id: entity.authorId },
        data: { reputation: { increment: voteValue } },
      })
    }

    await prisma.userActivity.create({
      data: { userId, action: 'VOTED', moduleType: module, entityId, entityTitle },
    })

    if (newVote === 'UPVOTE' && voteValue > 0 && entity.authorId && entity.authorId !== userId) {
      const notifyConfig = MODULE_VOTE_NOTIFICATION[module as ModuleKey]
      if (notifyConfig) {
        let targetId = entityId
        if (module === 'RECOMMENDATION') {
          const rec = await (prisma.recommendation as unknown as AnyDelegate).findUnique({
            where: { id: entityId },
            select: { supervisorId: true },
          })
          if (rec?.supervisorId) {
            targetId = `${rec.supervisorId}/${entityId}`
          }
        }

        const actor = await prisma.user.findUnique({
          where: { id: userId },
          select: { name: true, handle: true, email: true },
        })
        const actorName =
          actor?.name || actor?.handle || actor?.email?.split('@')[0] || 'Someone'
        const moduleName = MODULE_DISPLAY_NAME[module as ModuleKey] || 'content'

        await prisma.notification.create({
          data: {
            recipientId: entity.authorId,
            actorId: userId,
            type: notifyConfig.type,
            targetType: notifyConfig.targetType,
            targetId,
            title: `${actorName} upvoted your ${moduleName}`,
            body: entityTitle,
          },
        })
      }
    }

    return { totalVotes, userVote: newVote === currentVote ? null : newVote }
  })
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
  const commentModel = config.comment as unknown as AnyDelegate
  const commentVote = config.commentVote as unknown as AnyDelegate

  const voteWhere = {
    commentId_userId: { commentId, userId },
  }

  return prisma.$transaction(async (prisma) => {
    const [comment, existingVote] = await Promise.all([
      commentModel.findUnique({
        where: { id: commentId },
        select: { totalVotes: true, [config.commentFk]: true, content: true, authorId: true },
      }),
      commentVote.findUnique({ where: voteWhere, select: { voteType: true } }),
    ])

    if (!comment) throw new Error("Comment not found.")

    const currentVote = existingVote?.voteType || null
    const voteValue = getVoteValue(currentVote, newVote)
    const entityTitle = (comment as any).content as string || 'Untitled'
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
      await prisma.user.update({
        where: { id: comment.authorId },
        data: { reputation: { increment: voteValue } },
      })
    }

    await prisma.userActivity.create({
      data: {
        userId,
        action: 'VOTED',
        moduleType: `${moduleKey}_COMMENT`,
        entityId: commentId,
        entityTitle: entityTitle.substring(0, 50),
      },
    })

    return { totalVotes, userVote: newVote === currentVote ? null : newVote }
  })
}

// ============================================
// COMMENT TRANSACTIONS
// ============================================
type CommentModels = {
  parent: AnyDelegate
  parentFk: string
  commentModel: AnyDelegate
  titleField: string
  moduleKey: ModuleKey
}

function getCommentModels(moduleName: ModuleKey): CommentModels {
  const config = ENTITY_CONFIG[moduleName]
  if (!config) throw new Error(`Invalid module for comments: ${moduleName}`)

  return {
    parent: config.parent,
    parentFk: config.parentFk,
    commentModel: config.comment,
    titleField: config.titleField,
    moduleKey: moduleName,
  }
}

export async function createCommentTransaction(
  moduleName: ModuleKey,
  entityId: string,
  authorId: string,
  content: string,
  parentId?: string,
  mentions?: { id: string; handle: string | null }[],
) {
  const { commentModel, parent, parentFk, titleField } = getCommentModels(moduleName)

  return prisma.$transaction(async (prisma) => {
    const parentEntity = await parent.findUnique({
      where: { id: entityId },
      select: { [titleField]: true },
    })
    if (!parentEntity) throw new Error('Parent entity not found.')
    const entityTitle = (parentEntity as any)[titleField] as string

    const createdComment = await commentModel.create({
      data: { content, authorId, [parentFk]: entityId, parentId, mentions: mentions ?? undefined },
    })

    const operations: any[] = [
      parent.update({
        where: { id: entityId },
        data: { totalComments: { increment: 1 } },
      }),
    ]

    if (parentId) {
      operations.push(
        commentModel.update({
          where: { id: parentId },
          data: { totalReplies: { increment: 1 } },
        }),
      )
    }
    await prisma.$transaction(operations)

    await prisma.userActivity.create({
      data: {
        userId: authorId,
        action: parentId ? 'REPLIED' : 'COMMENTED',
        moduleType: moduleName,
        entityId,
        entityTitle,
      },
     })

    const author = await prisma.user.findUnique({
      where: { id: authorId },
      select: { id: true, name: true, handle: true, avatarUrl: true },
    })

    return {
      id: (createdComment as any).id,
      content,
      authorId,
      parentId,
      [parentFk]: entityId,
      createdAt: (createdComment as any).createdAt,
      totalVotes: 0,
      totalReplies: 0,
      mentions: mentions ?? null,
      author: author ?? null,
    }
  })
}

export async function deleteCommentTransaction(
  moduleName: ModuleKey,
  commentId: string,
  userId: string,
) {
  const { commentModel, parent, parentFk } = getCommentModels(moduleName)

  return prisma.$transaction(async (prisma) => {
    const comment = await commentModel.findUnique({
      where: { id: commentId },
      select: { authorId: true, totalReplies: true, parentId: true, [parentFk]: true, updatedAt: true, totalVotes: true },
    })

    if (!comment) throw new Error('Comment not found.')
    const userIsAdmin = await isUserAdmin(userId)
    if (comment.authorId !== userId && !userIsAdmin) {
      throw new Error('Not authorized to delete this comment.')
    }

    const shouldReverseRep = comment.authorId !== null && comment.totalVotes !== 0

    if (comment.totalReplies > 0 || (userIsAdmin && comment.authorId !== userId)) {
      await commentModel.update({
        where: { id: commentId },
        data: {
          content: userIsAdmin
            ? '[This comment was deleted by an administrator]'
            : '[This comment was deleted by author]',
          authorId: null,
          updatedAt: comment.updatedAt,
        },
      })

      if (shouldReverseRep) {
        await prisma.user.update({
          where: { id: comment.authorId },
          data: { reputation: { decrement: comment.totalVotes } },
        })
      }

      const parentEntityId = (comment as any)[parentFk] as string
      await parent.update({
        where: { id: parentEntityId },
        data: { totalComments: { decrement: 1 } },
      })

      return { wasTombstoned: true, parentId: comment.parentId }
    } else {
      await commentModel.delete({ where: { id: commentId } })

      const parentEntityId = (comment as any)[parentFk] as string
      const operations: any[] = [
        parent.update({
          where: { id: parentEntityId },
          data: { totalComments: { decrement: 1 } },
        }),
      ]
      if (comment.parentId) {
        operations.push(
          commentModel.update({
            where: { id: comment.parentId },
            data: { totalReplies: { decrement: 1 } },
          }),
        )
      }

      if (shouldReverseRep) {
        operations.push(
          prisma.user.update({
            where: { id: comment.authorId },
            data: { reputation: { decrement: comment.totalVotes } },
          }),
        )
      }

      await prisma.$transaction(operations)

      if (comment.parentId) {
        const parentComment = await commentModel.findUnique({
          where: { id: comment.parentId },
          select: { authorId: true, totalReplies: true, [parentFk]: true },
        })
        if (parentComment && !parentComment.authorId && parentComment.totalReplies === 0) {
          const parentEntityId2 = (parentComment as any)[parentFk] as string
          const cleanupOps: any[] = [
            commentModel.delete({ where: { id: comment.parentId } }),
          ]
          if (parentEntityId2) {
            const parentEntity = await parent.findUnique({
              where: { id: parentEntityId2 },
              select: { totalComments: true },
            })
            if (parentEntity && parentEntity.totalComments > 0) {
              cleanupOps.push(
                parent.update({
                  where: { id: parentEntityId2 },
                  data: { totalComments: { decrement: 1 } },
                }),
              )
            }
          }
          const parentParentId = (parentComment as any).parentId
          if (parentParentId) {
            cleanupOps.push(
              commentModel.update({
                where: { id: parentParentId },
                data: { totalReplies: { decrement: 1 } },
              }),
            )
          }
          await prisma.$transaction(cleanupOps)
        }
      }

      return { wasTombstoned: false, parentId: comment.parentId }
    }
  })
}

// ============================================
// COMMENT TYPE MAPPING
// ============================================
// Maps lowercase CommentEntityType to uppercase ModuleKey
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
