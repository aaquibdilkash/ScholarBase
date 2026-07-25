'use server'

import prisma from '@/lib/db'
import { requireCurrentUser } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { notifyUserById } from '@/lib/notifications'

type VoteType = 'UPVOTE' | 'DOWNVOTE'

// Model mapping: [type string] => { model, voteModel, uniqueWhere, createData, authorField, notifType, urlPrefix }
const VOTE_CONFIG: Record<string, {
  voteModel: any;
  uniqueFields: string[];
  targetIdField: string;
  notifType: string;
  urlPrefix: string;
  titleField: string;
}> = {
  article: {
    voteModel: prisma.articleVote,
    uniqueFields: ['articleId', 'userId'],
    targetIdField: 'articleId',
    notifType: 'article-upvoted',
    urlPrefix: '/blog/',
    titleField: 'title',
  },
  post: {
    voteModel: prisma.socialVote,
    uniqueFields: ['socialPostId', 'userId'],
    targetIdField: 'socialPostId',
    notifType: 'post-upvoted',
    urlPrefix: '/feed/',
    titleField: 'content',
  },
  vacancy: {
    voteModel: prisma.jobVacancyVote,
    uniqueFields: ['jobVacancyId', 'userId'],
    targetIdField: 'jobVacancyId',
    notifType: 'vacancy-upvoted',
    urlPrefix: '/vacancies/',
    titleField: 'title',
  },
  admission: {
    voteModel: prisma.phdAdmissionVote,
    uniqueFields: ['phdAdmissionId', 'userId'],
    targetIdField: 'phdAdmissionId',
    notifType: 'admission-upvoted',
    urlPrefix: '/admissions/',
    titleField: 'university',
  },
  event: {
    voteModel: prisma.researchEventVote,
    uniqueFields: ['researchEventId', 'userId'],
    targetIdField: 'researchEventId',
    notifType: 'event-upvoted',
    urlPrefix: '/events/',
    titleField: 'title',
  },
  supervisor: {
    voteModel: prisma.supervisorVote,
    uniqueFields: ['supervisorId', 'userId'],
    targetIdField: 'supervisorId',
    notifType: 'supervisor-upvoted',
    urlPrefix: '/supervisor/',
    titleField: 'name',
  },
  recommendation: {
    voteModel: prisma.recommendationVote,
    uniqueFields: ['recommendationId', 'userId'],
    targetIdField: 'recommendationId',
    notifType: 'recommendation-upvoted',
    urlPrefix: '/recommendation/',
    titleField: 'feedback',
  },
  help: {
    voteModel: prisma.helpPostVote,
    uniqueFields: ['helpPostId', 'userId'],
    targetIdField: 'helpPostId',
    notifType: 'help-post-upvoted',
    urlPrefix: '/help/',
    titleField: 'title',
  },
  journal: {
    voteModel: prisma.journalVote,
    uniqueFields: ['journalId', 'userId'],
    targetIdField: 'journalId',
    notifType: 'journal-upvoted',
    urlPrefix: '/journals/',
    titleField: 'title',
  },
  researchTool: {
    voteModel: prisma.researchToolVote,
    uniqueFields: ['researchToolId', 'userId'],
    targetIdField: 'researchToolId',
    notifType: 'research-tool-upvoted',
    urlPrefix: '/research-tools/',
    titleField: 'name',
  },
  result: {
    voteModel: prisma.resultVote,
    uniqueFields: ['resultId', 'userId'],
    targetIdField: 'resultId',
    notifType: 'result-upvoted',
    urlPrefix: '/results/',
    titleField: 'title',
  },
  contribution: {
    voteModel: prisma.contributionVote,
    uniqueFields: ['contributionId', 'userId'],
    targetIdField: 'contributionId',
    notifType: 'contribution-upvoted',
    urlPrefix: '/contributions/',
    titleField: 'title',
  },
}

// Model configs for each type to fetch author info for reputation
const CONTENT_AUTHOR_FETCH: Record<string, (targetId: string) => Promise<{ authorId: string; title: string } | null>> = {
  article: (id) => prisma.article.findUnique({ where: { id }, select: { authorId: true, title: true } }),
  post: (id) => prisma.socialPost.findUnique({ where: { id }, select: { authorId: true, content: true } }).then(r => r ? { authorId: r.authorId, title: r.content.slice(0, 120) } : null),
  vacancy: (id) => prisma.jobVacancy.findUnique({ where: { id }, select: { authorId: true, title: true } }),
  admission: (id) => prisma.phdAdmission.findUnique({ where: { id }, select: { authorId: true, university: true } }).then(r => r ? { authorId: r.authorId, title: r.university } : null),
  event: (id) => prisma.researchEvent.findUnique({ where: { id }, select: { authorId: true, title: true } }),
  supervisor: (id) => prisma.supervisor.findUnique({ where: { id }, select: { authorId: true, name: true } }).then(r => r ? { authorId: r.authorId, title: r.name } : null),
  recommendation: (id) => prisma.recommendation.findUnique({ where: { id }, select: { authorId: true, feedback: true } }).then(r => r ? { authorId: r.authorId, title: r.feedback.slice(0, 120) } : null),
  help: (id) => prisma.helpPost.findUnique({ where: { id }, select: { authorId: true, title: true } }),
  journal: (id) => prisma.journal.findUnique({ where: { id }, select: { authorId: true, title: true } }),
  researchTool: (id) => prisma.researchTool.findUnique({ where: { id }, select: { authorId: true, name: true } }).then(r => r ? { authorId: r.authorId, title: r.name } : null),
  result: (id) => prisma.result.findUnique({ where: { id }, select: { authorId: true, title: true } }),
  contribution: (id) => prisma.contribution.findUnique({ where: { id }, select: { authorId: true, title: true } }),
}

/**
 * 🔥 INCREMENTAL reputation update — 1 query instead of 23.
 * Adjusts reputation by the net change of the current vote action.
 */
export async function updateReputationIncremental(userId: string, voteDelta: number) {
  if (voteDelta === 0) return;
  await prisma.user.update({
    where: { id: userId },
    data: { reputation: { increment: voteDelta } },
  });
}

/**
 * Full recalc — only used for initial data or as a fallback.
 * Runs all counts in parallel using Promise.all for efficiency.
 */
export async function updateReputation(userId: string) {
  // Run all counts in parallel — 22 queries concurrently
  const counts = await Promise.all([
    prisma.articleVote.count({ where: { article: { authorId: userId }, voteType: 'UPVOTE' } }),
    prisma.articleVote.count({ where: { article: { authorId: userId }, voteType: 'DOWNVOTE' } }),
    prisma.socialVote.count({ where: { socialPost: { authorId: userId }, voteType: 'UPVOTE' } }),
    prisma.socialVote.count({ where: { socialPost: { authorId: userId }, voteType: 'DOWNVOTE' } }),
    prisma.jobVacancyVote.count({ where: { jobVacancy: { authorId: userId }, voteType: 'UPVOTE' } }),
    prisma.jobVacancyVote.count({ where: { jobVacancy: { authorId: userId }, voteType: 'DOWNVOTE' } }),
    prisma.phdAdmissionVote.count({ where: { phdAdmission: { authorId: userId }, voteType: 'UPVOTE' } }),
    prisma.phdAdmissionVote.count({ where: { phdAdmission: { authorId: userId }, voteType: 'DOWNVOTE' } }),
    prisma.researchEventVote.count({ where: { researchEvent: { authorId: userId }, voteType: 'UPVOTE' } }),
    prisma.researchEventVote.count({ where: { researchEvent: { authorId: userId }, voteType: 'DOWNVOTE' } }),
    prisma.supervisorVote.count({ where: { supervisor: { authorId: userId }, voteType: 'UPVOTE' } }),
    prisma.supervisorVote.count({ where: { supervisor: { authorId: userId }, voteType: 'DOWNVOTE' } }),
    prisma.recommendationVote.count({ where: { recommendation: { authorId: userId }, voteType: 'UPVOTE' } }),
    prisma.recommendationVote.count({ where: { recommendation: { authorId: userId }, voteType: 'DOWNVOTE' } }),
    prisma.helpPostVote.count({ where: { helpPost: { authorId: userId }, voteType: 'UPVOTE' } }),
    prisma.helpPostVote.count({ where: { helpPost: { authorId: userId }, voteType: 'DOWNVOTE' } }),
    prisma.journalVote.count({ where: { journal: { authorId: userId }, voteType: 'UPVOTE' } }),
    prisma.journalVote.count({ where: { journal: { authorId: userId }, voteType: 'DOWNVOTE' } }),
    prisma.researchToolVote.count({ where: { researchTool: { authorId: userId }, voteType: 'UPVOTE' } }),
    prisma.researchToolVote.count({ where: { researchTool: { authorId: userId }, voteType: 'DOWNVOTE' } }),
    prisma.resultVote.count({ where: { result: { authorId: userId }, voteType: 'UPVOTE' } }),
    prisma.resultVote.count({ where: { result: { authorId: userId }, voteType: 'DOWNVOTE' } }),
    prisma.contributionVote.count({ where: { contribution: { authorId: userId }, voteType: 'UPVOTE' } }),
    prisma.contributionVote.count({ where: { contribution: { authorId: userId }, voteType: 'DOWNVOTE' } }),
    prisma.articleCommentVote.count({ where: { comment: { authorId: userId }, voteType: 'UPVOTE' } }),
    prisma.articleCommentVote.count({ where: { comment: { authorId: userId }, voteType: 'DOWNVOTE' } }),
    prisma.socialCommentVote.count({ where: { comment: { authorId: userId }, voteType: 'UPVOTE' } }),
    prisma.socialCommentVote.count({ where: { comment: { authorId: userId }, voteType: 'DOWNVOTE' } }),
    prisma.jobVacancyCommentVote.count({ where: { comment: { authorId: userId }, voteType: 'UPVOTE' } }),
    prisma.jobVacancyCommentVote.count({ where: { comment: { authorId: userId }, voteType: 'DOWNVOTE' } }),
    prisma.phdAdmissionCommentVote.count({ where: { comment: { authorId: userId }, voteType: 'UPVOTE' } }),
    prisma.phdAdmissionCommentVote.count({ where: { comment: { authorId: userId }, voteType: 'DOWNVOTE' } }),
    prisma.researchEventCommentVote.count({ where: { comment: { authorId: userId }, voteType: 'UPVOTE' } }),
    prisma.researchEventCommentVote.count({ where: { comment: { authorId: userId }, voteType: 'DOWNVOTE' } }),
    prisma.supervisorCommentVote.count({ where: { comment: { authorId: userId }, voteType: 'UPVOTE' } }),
    prisma.supervisorCommentVote.count({ where: { comment: { authorId: userId }, voteType: 'DOWNVOTE' } }),
    prisma.recommendationCommentVote.count({ where: { comment: { authorId: userId }, voteType: 'UPVOTE' } }),
    prisma.recommendationCommentVote.count({ where: { comment: { authorId: userId }, voteType: 'DOWNVOTE' } }),
    prisma.helpPostCommentVote.count({ where: { comment: { authorId: userId }, voteType: 'UPVOTE' } }),
    prisma.helpPostCommentVote.count({ where: { comment: { authorId: userId }, voteType: 'DOWNVOTE' } }),
    prisma.journalCommentVote.count({ where: { comment: { authorId: userId }, voteType: 'UPVOTE' } }),
    prisma.journalCommentVote.count({ where: { comment: { authorId: userId }, voteType: 'DOWNVOTE' } }),
    prisma.researchToolCommentVote.count({ where: { comment: { authorId: userId }, voteType: 'UPVOTE' } }),
    prisma.researchToolCommentVote.count({ where: { comment: { authorId: userId }, voteType: 'DOWNVOTE' } }),
    prisma.resultCommentVote.count({ where: { comment: { authorId: userId }, voteType: 'UPVOTE' } }),
    prisma.resultCommentVote.count({ where: { comment: { authorId: userId }, voteType: 'DOWNVOTE' } }),
  ]);

  let upSum = 0;
  let downSum = 0;
  for (let i = 0; i < counts.length; i += 2) {
    upSum += counts[i];
    downSum += counts[i + 1];
  }

  const reputation = upSum - downSum;
  await prisma.user.update({
    where: { id: userId },
    data: { reputation },
  });
}

// Helper to toggle vote for any model (used inside and outside transactions)
async function performVoteOp(
  model: any,
  uniqueFields: string[],
  targetId: string,
  userId: string,
  voteType: VoteType,
): Promise<{ userVote: VoteType | null; upvotes: number; downvotes: number; previousVoteType: VoteType | null }> {
  const field1 = uniqueFields[0];
  const field2 = uniqueFields[1];
  const whereComposite = { [`${field1}_${field2}`]: { [field1]: targetId, [field2]: userId } };

  const existing = await model.findUnique({ where: whereComposite });

  const previousVoteType: VoteType | null = existing?.voteType ?? null;
  let finalVoteType: VoteType | null = voteType;

  if (existing) {
    if (existing.voteType === voteType) {
      await model.delete({ where: { id: existing.id } });
      finalVoteType = null;
    } else {
      await model.update({ where: { id: existing.id }, data: { voteType } });
      finalVoteType = voteType;
    }
  } else {
    await model.create({ data: { [field1]: targetId, [field2]: userId, voteType } });
    finalVoteType = voteType;
  }

  const [upvotes, downvotes] = await Promise.all([
    model.count({ where: { [field1]: targetId, voteType: 'UPVOTE' } }),
    model.count({ where: { [field1]: targetId, voteType: 'DOWNVOTE' } }),
  ]);

  return { userVote: finalVoteType, upvotes, downvotes, previousVoteType };
}

export async function toggleVote(
  targetId: string,
  type: string,
  voteType: VoteType,
): Promise<{ userVote: VoteType | null; upvotes: number; downvotes: number }> {
  const user = await requireCurrentUser('Log in to vote.')

  const config = VOTE_CONFIG[type]
  if (!config) throw new Error(`Unknown vote type: ${type}`)

  // Perform the vote operation (non-transacted for simplicity, but atomic enough)
  const result = await performVoteOp(
    config.voteModel,
    config.uniqueFields,
    targetId,
    user.id,
    voteType,
  );

  // 🔥 Accurate incremental reputation update based on actual vote change
  const authorInfo = await CONTENT_AUTHOR_FETCH[type]?.(targetId)
  if (authorInfo?.authorId) {

    // - New vote: +1 for upvote, -1 for downvote
    const prev = result.previousVoteType;
    let voteDelta = 0;

    if (prev === voteType) {
      // Removing vote (toggle off)
      voteDelta = voteType === 'UPVOTE' ? -1 : 1;
    } else if (prev === null) {
      // New vote
      voteDelta = voteType === 'UPVOTE' ? 1 : -1;
    } else {
      // Switching vote (prev is opposite direction)
      voteDelta = voteType === 'UPVOTE' ? 2 : -2;
    }

    await updateReputationIncremental(authorInfo.authorId, voteDelta);
  }

  // 🔥 Fire-and-forget notification (non-blocking)
  if (result.userVote === 'UPVOTE' && authorInfo?.authorId) {
    notifyUserById({
      recipientId: authorInfo.authorId,
      actorId: user.id,
      type: config.notifType,
      targetType: type,
      targetId,
      title: `${user.email?.split('@')[0] || 'Someone'} upvoted your ${type}`,
      body: authorInfo.title,
    }).catch(() => { });
  }

  // Revalidate paths — ensure profile/scholar page also refreshes
  const paths = [config.urlPrefix]
  if (!['article', 'post'].includes(type)) {
    paths.push(`${config.urlPrefix}${targetId}`)
  }
  // Add author profile revalidation
  if (authorInfo?.authorId) {
    paths.push(`/scholar/${authorInfo.authorId}`)
  }
  for (const p of paths) {
    if (p.startsWith('/blog')) {
      // revalidate both layout and the specific article page
      revalidatePath('/blog', 'layout')
      revalidatePath(p, 'page')
    } else {
      revalidatePath(p)
    }
  }

  return result
}

