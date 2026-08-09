'use server'

import prisma from '@/lib/db'
import { requireCurrentUser } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { notifyUserById } from '@/lib/notifications'

import type { VoteType } from '@/types/votes'
import { VoteModel, VoteDelegate } from '@/types/interactions'

const VOTE_CONFIG: Record<string, {
  voteModel: VoteModel;
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
    urlPrefix: '',
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

// Calculate net vote value for a content item and reverse reputation from votes/comments
export async function reverseReputationForContent(authorId: string, voteCounts: { upvotes: number; downvotes: number }, commentCount?: number) {
  // Remove reputation gained from votes: each upvote = +1, each downvote = -1
  const reputationFromVotes = voteCounts.upvotes - voteCounts.downvotes;
  // Remove reputation from comments (if any): +1 per comment
  const reputationFromComments = commentCount ?? 0;
  const totalReputationToRemove = reputationFromVotes + reputationFromComments;

  if (totalReputationToRemove !== 0) {
    await prisma.user.update({
      where: { id: authorId },
      data: { reputation: { increment: -totalReputationToRemove } },
    });
  }
}

// Count votes for a specific model and target
export async function countVotesForTarget<TDelegate>(
  model: TDelegate,
  targetIdField: string,
  targetId: string,
) {
  const counts = await (model as {
    groupBy: (args: {
      by: string[];
      where: Record<string, string>;
      _count: { _all: true };
    }) => Promise<{ voteType: VoteType; _count: { _all: number } }[]>;
  }).groupBy({
    by: ['voteType'],
    where: { [targetIdField]: targetId },
    _count: { _all: true },
  });

  const upvotes = counts.find((c) => c.voteType === 'UPVOTE')?._count._all || 0;
  const downvotes = counts.find((c) => c.voteType === 'DOWNVOTE')?._count._all || 0;

  return { upvotes, downvotes };
}

// Count comments for a specific model and target
export async function countCommentsForTarget<TDelegate>(
  model: TDelegate,
  targetIdField: string,
  targetId: string,
) {
  return (model as {
    count: (args: { where: Record<string, string> }) => Promise<number>;
  }).count({ where: { [targetIdField]: targetId } });
}

export async function reverseReputationForSupervisor(supervisorId: string) {
  const supervisor = await prisma.supervisor.findUnique({
    where: { id: supervisorId },
    select: { authorId: true, recommendations: { select: { id: true, authorId: true } } },
  });

  if (!supervisor) return;

  const reputationDeltas = new Map<string, number>();
  const addDelta = (userId: string, delta: number) => {
    reputationDeltas.set(userId, (reputationDeltas.get(userId) || 0) + delta);
  };

  // 1. Votes on the supervisor profile
  const supervisorVoteCounts = await prisma.supervisorVote.groupBy({
    by: ['voteType'],
    where: { supervisorId },
    _count: { _all: true },
  });
  const svUpvotes = supervisorVoteCounts.find(v => v.voteType === 'UPVOTE')?._count._all || 0;
  const svDownvotes = supervisorVoteCounts.find(v => v.voteType === 'DOWNVOTE')?._count._all || 0;
  if ((svUpvotes - svDownvotes) !== 0) {
    addDelta(supervisor.authorId, -(svUpvotes - svDownvotes));
  }

  // 2. Comments on the supervisor profile
  const supervisorCommentAuthors = await prisma.supervisorComment.groupBy({
    by: ['authorId'],
    where: { supervisorId },
    _count: { _all: true },
  });
  for (const author of supervisorCommentAuthors) {
    addDelta(author.authorId, -author._count._all);
  }

  if (supervisor.recommendations.length > 0) {
    const recommendationIds = supervisor.recommendations.map(r => r.id);

    // 3. Rep for creating recommendations
    for (const rec of supervisor.recommendations) {
      addDelta(rec.authorId, -2);
    }

    // 4. Votes on all recommendations
    const recVotes = await prisma.recommendationVote.groupBy({
      by: ['recommendationId', 'voteType'],
      where: { recommendationId: { in: recommendationIds } },
      _count: { _all: true },
    });

    const recVoteRep = new Map<string, number>();
    for (const vote of recVotes) {
      const rep = recVoteRep.get(vote.recommendationId) || 0;
      recVoteRep.set(vote.recommendationId, rep + (vote.voteType === 'UPVOTE' ? 1 : -1));
    }

    for (const rec of supervisor.recommendations) {
      const rep = recVoteRep.get(rec.id);
      if (rep) {
        addDelta(rec.authorId, -rep);
      }
    }

    // 5. Comments on all recommendations
    const recCommentAuthors = await prisma.recommendationComment.groupBy({
      by: ['authorId', 'recommendationId'],
      where: { recommendationId: { in: recommendationIds } },
      _count: { _all: true },
    });

    for (const comment of recCommentAuthors) {
      addDelta(comment.authorId, -comment._count._all);
    }
  }

  const updates = Array.from(reputationDeltas.entries())
    .filter(([, delta]) => delta !== 0)
    .map(([userId, delta]) =>
      prisma.user.update({
        where: { id: userId },
        data: { reputation: { increment: delta } },
      }),
    );

  if (updates.length > 0) {
    await prisma.$transaction(updates);
  }
}

export async function reverseReputationForRecommendation(recommendationId: string) {
  const recommendation = await prisma.recommendation.findUnique({
    where: { id: recommendationId },
    select: { authorId: true },
  });

  if (!recommendation) return;

  const reputationDeltas = new Map<string, number>();
  const addDelta = (userId: string, delta: number) => {
    reputationDeltas.set(userId, (reputationDeltas.get(userId) || 0) + delta);
  };

  // 1. The recommendation itself gives the author +2 rep
  addDelta(recommendation.authorId, -2);

  // 2. Votes on the recommendation
  const voteCounts = await prisma.recommendationVote.groupBy({
    by: ['voteType'],
    where: { recommendationId },
    _count: { _all: true },
  });

  const upvotes = voteCounts.find(v => v.voteType === 'UPVOTE')?._count._all || 0;
  const downvotes = voteCounts.find(v => v.voteType === 'DOWNVOTE')?._count._all || 0;
  const recVoteRep = upvotes - downvotes;

  if (recVoteRep !== 0) {
    addDelta(recommendation.authorId, -recVoteRep);
  }

  // 3. Comments on the recommendation
  const commentAuthors = await prisma.recommendationComment.groupBy({
    by: ['authorId'],
    where: { recommendationId },
    _count: { _all: true },
  });

  for (const author of commentAuthors) {
    addDelta(author.authorId, -author._count._all);
  }

  const updates = Array.from(reputationDeltas.entries()).map(([userId, delta]) =>
    prisma.user.update({
      where: { id: userId },
      data: { reputation: { increment: delta } },
    }),
  );

  if (updates.length > 0) {
    await prisma.$transaction(updates);
  }
}

async function performVoteOp(
  model: VoteDelegate,
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

  const counts = await model.groupBy({
    by: ['voteType'],
    where: { [field1]: targetId },
    _count: { _all: true },
  });

  const upvotes = counts.find((c) => c.voteType === 'UPVOTE')?._count._all || 0;
  const downvotes = counts.find((c) => c.voteType === 'DOWNVOTE')?._count._all || 0;

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
    config.voteModel as unknown as VoteDelegate,
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

  const paths: string[] = []
  if (type === 'recommendation') {
    const recommendation = await prisma.recommendation.findUnique({
      where: { id: targetId },
      select: { supervisorId: true }
    });
    if (recommendation) {
      paths.push(`/supervisor/${recommendation.supervisorId}/recommendation/${targetId}`);
    }
  } else {
    // Original logic for other types
    paths.push(config.urlPrefix)
    if (!['article', 'post'].includes(type)) {
      paths.push(`${config.urlPrefix}${targetId}`)
    }
  }

  if (authorInfo?.authorId) {
    paths.push(`/scholars/${authorInfo.authorId}`)
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
