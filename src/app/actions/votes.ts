"use server";

import {
  handleVoteTransaction,
  handleCommentVoteTransaction,
  ModuleKey,
} from "@/lib/transactions";
import { requireCurrentUser } from "@/lib/auth";
import { VoteType } from "@prisma/client";
import type { CommentEntityType } from "@/types/comments";
import { checkRateLimit, RATE_LIMIT_ERROR } from "@/lib/rate-limit";

export async function voteOnContent(
  entityId: string,
  newVoteType: VoteType,
  module: ModuleKey,
) {
  const user = await requireCurrentUser("You must be logged in to vote.");

  if (!entityId || !newVoteType || !module) {
    throw new Error("Missing required parameters for voting.");
  }

  const rateLimit = await checkRateLimit({
    namespace: `vote:${module}`,
    key: user.id,
    limit: 120,
    window: "1 m",
  });

  if (!rateLimit.allowed) {
    return { success: false, error: RATE_LIMIT_ERROR };
  }

  try {
    const { totalVotes, userVote } = await handleVoteTransaction(
      module,
      entityId,
      user.id,
      newVoteType,
    );

    return { success: true, data: { totalVotes, userVote } };
  } catch (error) {
    console.error(`Error voting on ${module} (${entityId}):`, error);
    return { success: false, error: "An unexpected error occurred." };
  }
}

export async function toggleCommentVote(
  commentId: string,
  type: CommentEntityType,
  voteType: VoteType,
) {
  const user = await requireCurrentUser("You must be logged in to vote.");

  const rateLimit = await checkRateLimit({
    namespace: `comment-vote:${type}`,
    key: user.id,
    limit: 120,
    window: "1 m",
  });

  if (!rateLimit.allowed) {
    return { success: false, error: RATE_LIMIT_ERROR };
  }

  try {
    const { totalVotes, userVote } = await handleCommentVoteTransaction(
      commentId,
      user.id,
      voteType,
      type,
    );

    return { success: true, data: { totalVotes, userVote } };
  } catch (error) {
    console.error(`Error voting on comment (${commentId}):`, error);
    return { success: false, error: "An unexpected error occurred." };
  }
}
