"use client";

import { toggleVote } from "@/app/actions/interactions";
import { useOptimistic, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { useAuthModal } from "./AuthModal";
import type { VoteType, VoteTargetType } from "@/types/votes";

type VoteState = {
  userVote: VoteType | null;
  upvotes: number;
  downvotes: number;
};

function applyVote(state: VoteState, voteType: VoteType): VoteState {
  if (state.userVote === voteType) {
    return {
      userVote: null,
      upvotes: state.upvotes - (voteType === "UPVOTE" ? 1 : 0),
      downvotes: state.downvotes - (voteType === "DOWNVOTE" ? 1 : 0),
    };
  }

  return {
    userVote: voteType,
    upvotes:
      state.upvotes +
      (voteType === "UPVOTE" ? 1 : 0) -
      (state.userVote === "UPVOTE" ? 1 : 0),
    downvotes:
      state.downvotes +
      (voteType === "DOWNVOTE" ? 1 : 0) -
      (state.userVote === "DOWNVOTE" ? 1 : 0),
  };
}

export function VoteButton({
  targetId,
  type,
  initialUpvotes,
  initialDownvotes,
  initialUserVote,
}: {
  targetId: string;
  type: VoteTargetType;
  initialUpvotes: number;
  initialDownvotes: number;
  initialUserVote: VoteType | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [pendingVote, setPendingVote] = useState<VoteType | null>(null);
  const [voteState, setVoteState] = useState<VoteState>({
    userVote: initialUserVote,
    upvotes: initialUpvotes,
    downvotes: initialDownvotes,
  });
  const [optimisticVotes, addOptimisticVote] = useOptimistic(
    voteState,
    applyVote,
  );
  const { toast } = useToast();
  const { openAuthModal } = useAuthModal();

  const { userVote } = optimisticVotes;
  const netScore = optimisticVotes.upvotes - optimisticVotes.downvotes;

  const handleVote = (voteType: VoteType) => {
    setPendingVote(voteType);
    startTransition(async () => {
      addOptimisticVote(voteType);
      try {
        const result = await toggleVote(targetId, type, voteType);
        if ("error" in result) {
          if (result.error === "UNAUTHORIZED") {
            openAuthModal();
          }
          return;
        }
        setVoteState(result);
        toast("Vote registered!", "success");
      } catch {
        toast("Failed to register vote. Please try again.", "error");
      } finally {
        setPendingVote(null);
      }
    });
  };

  return (
    <div className="flex items-center gap-1">
      <button
        disabled={isPending}
        onClick={() => handleVote("UPVOTE")}
        className={`inline-flex items-center gap-1 rounded-l-full border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold transition hover:border-green-300 hover:text-green-600 disabled:cursor-not-allowed disabled:opacity-70 ${
          userVote === "UPVOTE"
            ? "bg-green-50 text-green-600 border-green-300"
            : "text-black-500"
        }`}
        title="Upvote"
      >
        {isPending && pendingVote === "UPVOTE" ? (
          <Loader2 className="animate-spin h-4 w-4" />
        ) : (
          <ArrowUp
            className={`w-4 h-4 ${userVote === "UPVOTE" ? "text-green-600" : ""}`}
          />
        )}
      </button>

      <span
        className={`inline-flex items-center justify-center min-w-[1.5rem] text-xs font-bold px-1 ${
          netScore > 0
            ? "text-green-600"
            : netScore < 0
              ? "text-red-600"
              : "text-black-500"
        }`}
      >
        {netScore}
      </span>

      <button
        disabled={isPending}
        onClick={() => handleVote("DOWNVOTE")}
        className={`inline-flex items-center gap-1 rounded-r-full border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold transition hover:border-red-300 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-70 ${
          userVote === "DOWNVOTE"
            ? "bg-red-50 text-red-600 border-red-300"
            : "text-black-500"
        }`}
        title="Downvote"
      >
        {isPending && pendingVote === "DOWNVOTE" ? (
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
