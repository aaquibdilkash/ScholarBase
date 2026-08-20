// src/types/comments.ts

import type { VoteType } from "./votes";

export type CommentEntityType =
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

export interface CommentAuthor {
  id: string;
  name: string | null;
  handle: string | null;
  avatarUrl: string | null;
}

export interface CommentWithAuthorAndVotes {
  id: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  editedAt?: Date | null;
  authorId?: string | null;
  parentId?: string | null;
  totalVotes: number;
  totalReplies?: number;
  author: CommentAuthor | null;
  votes: { voteType: VoteType }[] | undefined;
  mentions?: { id: string; handle: string | null }[] | null;
  replies?: CommentWithAuthorAndVotes[];
}

export interface CommentModel {
  findUnique: (args: {
    where: { id: string };
    select: { authorId: true; parentId?: true };
  }) => Promise<{ authorId: string; parentId?: string | null } | null>;
  update: (args: {
    where: { id: string };
    data: {
      content: string;
      mentions?: { id: string; handle: string }[];
    };
    select?: object;
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

export interface CommentActionConfig {
  model: CommentModel;
}
