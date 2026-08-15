// src/types/comments.ts

export type CommentType =
  | 'article'
  | 'post'
  | 'vacancy'
  | 'admission'
  | 'event'
  | 'supervisor'
  | 'recommendation'
  | 'help'
  | 'journal'
  | 'researchTool'
  | 'researchGrant'
  | 'course'
  | 'result'
  | 'contribution'
  | 'publication'
  | 'survey';

/**
 * Structural model interface for comment delegates. Using a structural
 * interface (rather than a union of Prisma delegate types) keeps method
 * calls like findUnique / update / delete / count type-safe.
 */
export interface CommentModel {
  findUnique: (args: {
    where: { id: string };
    select: { authorId: true };
  }) => Promise<{ authorId: string } | null>;
  update: (args: {
    where: { id: string };
    data: { content: string };
  }) => Promise<unknown>;
  delete: (args: { where: { id: string } }) => Promise<unknown>;
}

export interface CommentVoteModel {
  findUnique: (args: {
    where: { commentId_userId: { commentId: string; userId: string } };
  }) => Promise<{ id: string; voteType: 'UPVOTE' | 'DOWNVOTE' } | null>;
  delete: (args: { where: { id: string } }) => Promise<unknown>;
  update: (args: {
    where: { id: string };
    data: { voteType: 'UPVOTE' | 'DOWNVOTE' };
  }) => Promise<unknown>;
  create: (args: {
    data: {
      commentId: string;
      userId: string;
      voteType: 'UPVOTE' | 'DOWNVOTE';
    };
  }) => Promise<unknown>;
  count: (args: {
    where: { commentId: string; voteType: 'UPVOTE' | 'DOWNVOTE' };
  }) => Promise<number>;
}

/**
 * Comment action configuration used across comment action files.
 */

export interface CommentActionConfig {
  model: CommentModel;
  revalidate: string;
}
