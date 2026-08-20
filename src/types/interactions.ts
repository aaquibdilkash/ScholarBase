import prisma from '@/lib/db'

export type VoteType = 'UPVOTE' | 'DOWNVOTE';

export type VoteModel =
  | typeof prisma.articleVote
  | typeof prisma.socialVote
  | typeof prisma.jobVacancyVote
  | typeof prisma.phdAdmissionVote
  | typeof prisma.researchEventVote
  | typeof prisma.supervisorVote
  | typeof prisma.recommendationVote
  | typeof prisma.helpPostVote
  | typeof prisma.journalVote
  | typeof prisma.researchToolVote
  | typeof prisma.researchGrantVote
  | typeof prisma.courseVote
  | typeof prisma.resultVote
  | typeof prisma.contributionVote
  | typeof prisma.publicationVote
  | typeof prisma.surveyVote;

/**
 * Minimal structural interface covering the delegate methods used when
 * performing vote operations. This avoids the TS union-call incompatibility
 * introduced by the `VoteModel` union of Prisma delegates.
 */
export interface VoteDelegate {
  findUnique: (args: unknown) => Promise<{ id: string; voteType: VoteType } | null>;
  create: (args: unknown) => Promise<{ id: string }>;
  update: (args: unknown) => Promise<{ id: string }>;
  delete: (args: unknown) => Promise<{ id: string }>;
}

export type CommentModel =
  | typeof prisma.articleComment
  | typeof prisma.socialComment
  | typeof prisma.researchEventComment
  | typeof prisma.jobVacancyComment
  | typeof prisma.phdAdmissionComment
  | typeof prisma.supervisorComment
  | typeof prisma.recommendationComment
  | typeof prisma.helpPostComment
  | typeof prisma.journalComment
  | typeof prisma.researchToolComment
  | typeof prisma.researchGrantComment
  | typeof prisma.courseComment
  | typeof prisma.resultComment
  | typeof prisma.contributionComment
  | typeof prisma.publicationComment
  | typeof prisma.surveyComment;

export type CommentVoteModel =
  | typeof prisma.articleCommentVote
  | typeof prisma.socialCommentVote
  | typeof prisma.researchEventCommentVote
  | typeof prisma.jobVacancyCommentVote
  | typeof prisma.phdAdmissionCommentVote
  | typeof prisma.supervisorCommentVote
  | typeof prisma.recommendationCommentVote
  | typeof prisma.helpPostCommentVote
  | typeof prisma.journalCommentVote
  | typeof prisma.researchToolCommentVote
  | typeof prisma.researchGrantCommentVote
  | typeof prisma.courseCommentVote
  | typeof prisma.resultCommentVote
  | typeof prisma.contributionCommentVote
  | typeof prisma.publicationCommentVote
  | typeof prisma.surveyCommentVote;
