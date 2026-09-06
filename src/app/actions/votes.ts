"use server";

import {
  handleVoteTransaction,
  handleCommentVoteTransaction,
  ModuleKey,
} from "@/lib/transactions";
import { getActiveUser } from "@/lib/auth";
import { VoteType } from "@prisma/client";
import type { CommentEntityType } from "@/types/comments";
import { checkRateLimit, RATE_LIMIT_ERROR } from "@/lib/rate-limit";

export async function voteOnContent(
  entityId: string,
  newVoteType: VoteType,
  module: ModuleKey,
) {
  // Graceful auth: frozen accounts must get a `{ success: false, error }`
  // payload (rendered as a toast) instead of a thrown Server Action error
  // that crashes the page. Logged-out users still redirect via
  // requireCurrentUser inside getActiveUser.
  const auth = await getActiveUser("You must be logged in to vote.");
  if (auth.frozen) {
    return { success: false, error: auth.message };
  }
  const user = auth.user;

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
  const auth = await getActiveUser("You must be logged in to vote.");
  if (auth.frozen) {
    return { success: false, error: auth.message };
  }
  const user = auth.user;

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
