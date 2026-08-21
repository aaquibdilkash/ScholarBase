"use client";

import { voteOnContent } from "@/app/actions/votes";
import { useOptimistic, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { useAuthModal } from "@/components/interactions/AuthModal";
import { useUser } from "@/hooks/useUser";
import type { VoteType } from "@prisma/client";
import { VOTE_CONFIG } from "@/lib/transactions";

type VoteState = {
  totalVotes: number;
  userVote: VoteType | null;
};

/**
 * Client-side logic to predict the outcome of a vote action.
 * This is used by `useOptimistic` to provide instant UI feedback.
 */
function applyVoteChange(state: VoteState, newVote: VoteType): VoteState {
  const { totalVotes, userVote } = state;

  // Case 1: User is retracting their vote (e.g., clicking upvote when already upvoted).
  if (userVote === newVote) {
    return {
      userVote: null,
      totalVotes: totalVotes + (newVote === "UPVOTE" ? -1 : 1),
    };
  }

  // Case 2: User is changing their vote (e.g., from upvote to downvote).
  if (userVote) {
    return {
      userVote: newVote,
      totalVotes: totalVotes + (newVote === "UPVOTE" ? 2 : -2),
    };
  }
  
  // Case 3: User is casting a new vote.
  return {
    userVote: newVote,
    totalVotes: totalVotes + (newVote === "UPVOTE" ? 1 : -1),
  };
}

export function VoteButton({
  targetId,
  module,
  initialTotalVotes,
  initialUserVote,
}: {
  targetId: string;
  module: keyof typeof VOTE_CONFIG;
  initialTotalVotes: number;
  initialUserVote: VoteType | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [nonOptimisticState, setNonOptimisticState] = useState<VoteState>({
    totalVotes: initialTotalVotes,
    userVote: initialUserVote,
  });

  const [optimisticState, setOptimisticState] = useOptimistic(
    nonOptimisticState,
    applyVoteChange,
  );

  const { toast } = useToast();
  const { openAuthModal } = useAuthModal();
  const { user } = useUser();

  const handleVote = (voteType: VoteType) => {
    if (!user) {
      openAuthModal();
      return;
    }

    startTransition(async () => {
      setOptimisticState(voteType);
      
      const result = await voteOnContent(
        targetId,
        voteType,
        module,
      );

      if (result.success && result.data) {
        setNonOptimisticState({
          totalVotes: result.data.totalVotes,
          userVote: result.data.userVote,
        });
        toast({
          title: "Success",
          description: result.data.userVote ? "Vote Registered!" : "Vote Removed!",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to register vote. Please try again.",
          variant: "destructive",
        });
      }
    });
  };

  const { totalVotes, userVote } = optimisticState;
  const isUpvoting = isPending && optimisticState.userVote === 'UPVOTE' && nonOptimisticState.userVote !== 'UPVOTE';
  const isDownvoting = isPending && optimisticState.userVote === 'DOWNVOTE' && nonOptimisticState.userVote !== 'DOWNVOTE';

  return (
    <div className="flex items-center gap-1">
      <button
        disabled={isPending}
        onClick={() => handleVote("UPVOTE")}
        className={`inline-flex items-center gap-1 rounded-l-full border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold transition hover:border-green-300 hover:text-green-600 disabled:cursor-not-allowed disabled:opacity-70 ${
          userVote === "UPVOTE"
            ? "bg-green-50 text-green-600 border-green-300"
            : "text-slate-500"
        }`}
        title="Upvote"
      >
        {isUpvoting ? (
          <Loader2 className="animate-spin h-4 w-4" />
        ) : (
          <ArrowUp
            className={`w-4 h-4 ${userVote === "UPVOTE" ? "text-green-600" : ""}`}
          />
        )}
      </button>

      <span
        className={`inline-flex items-center justify-center min-w-[1.5rem] text-xs font-bold px-1 ${
          totalVotes > 0
            ? "text-green-600"
            : totalVotes < 0
              ? "text-red-600"
              : "text-slate-500"
        }`}
      >
        {totalVotes}
      </span>

      <button
        disabled={isPending}
        onClick={() => handleVote("DOWNVOTE")}
        className={`inline-flex items-center gap-1 rounded-r-full border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold transition hover:border-red-300 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-70 ${
          userVote === "DOWNVOTE"
            ? "bg-red-50 text-red-600 border-red-300"
            : "text-slate-500"
        }`}
        title="Downvote"
      >
        {isDownvoting ? (
          <Loader2 className="animate-spin h-4 w-4" />
        ) : (
          <ArrowDown
            className={`w-4 h-4 ${userVote === "DOWNVOTE" ? "text-red-600" : ""}`}
          />
        )}
      </button>
    </div>
  );
}
