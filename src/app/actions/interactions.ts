'use server'

import prisma from '@/lib/db'
import { requireCurrentUser } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { notifyUserById } from '@/lib/notifications'

type VoteType = 'UPVOTE' | 'DOWNVOTE'

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
  publication: {
    voteModel: prisma.publicationVote,
    uniqueFields: ['publicationId', 'userId'],
    targetIdField: 'publicationId',
    notifType: 'publication-upvoted',
    urlPrefix: '/publications/',
    titleField: 'title',
  },
  survey: {
    voteModel: prisma.surveyVote,
    uniqueFields: ['surveyId', 'userId'],
    targetIdField: 'surveyId',
    notifType: 'survey-upvoted',
    urlPrefix: '/surveys/',
    titleField: 'title',
  },
}

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
  publication: (id) => prisma.publication.findUnique({ where: { id }, select: { authorId: true, title: true } }),
  survey: (id) => prisma.researchSurvey.findUnique({ where: { id }, select: { authorId: true, title: true } }),
}

export async function updateReputationIncremental(userId: string, voteDelta: number) {
  if (voteDelta === 0) return;
  await prisma.user.update({
    where: { id: userId },
    data: { reputation: { increment: voteDelta } },
  });
}

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
): Promise<{ userVote: VoteType | null; upvotes: number; downvotes: number } | { error: string }> {
  let user;
  try {
    user = await requireCurrentUser();
  } catch {
    return { error: "UNAUTHORIZED" };
  }

  const config = VOTE_CONFIG[type]
  if (!config) throw new Error(`Unknown vote type: ${type}`)

  const result = await performVoteOp(
    config.voteModel,
    config.uniqueFields,
    targetId,
    user.id,
    voteType,
  );

  const authorInfo = await CONTENT_AUTHOR_FETCH[type]?.(targetId)
  if (authorInfo?.authorId) {
    const prev = result.previousVoteType;
    let voteDelta = 0;

    if (prev === voteType) {
      voteDelta = voteType === 'UPVOTE' ? -1 : 1;
    } else if (prev === null) {
      voteDelta = voteType === 'UPVOTE' ? 1 : -1;
    } else {
      voteDelta = voteType === 'UPVOTE' ? 2 : -2;
    }

    await updateReputationIncremental(authorInfo.authorId, voteDelta);
  }

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

  const paths = [config.urlPrefix]
  if (!['article', 'post'].includes(type)) {
    paths.push(`${config.urlPrefix}${targetId}`)
  }
  if (authorInfo?.authorId) {
    paths.push(`/scholar/${authorInfo.authorId}`)
  }
  for (const p of paths) {
    if (p.startsWith('/blog')) {
      revalidatePath('/blog', 'layout')
      revalidatePath(p, 'page')
    } else {
      revalidatePath(p)
    }
  }

  return result
}
