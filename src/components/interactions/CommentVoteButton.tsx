"use client";

import { useOptimistic, useState, useTransition } from "react";
import { toggleCommentVote } from "@/app/actions/comments";
import { ArrowDown, ArrowUp, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { useAuthModal } from "./AuthModal";
import type { VoteType } from "@/types/votes";

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

export function CommentVoteButton({
  commentId,
  type,
  initialUpvotes,
  initialDownvotes,
  initialUserVote,
}: {
  commentId: string;
  type:
    | "article"
    | "post"
    | "vacancy"
    | "admission"
    | "event"
    | "supervisor"
    | "recommendation"
    | "help"
    | "researchTool"
    | "researchGrant"
    | "course"
    | "journal"
    | "result"
    | "contribution"
    | "publication"
    | "survey";
  initialUpvotes: number;
  initialDownvotes: number;
  initialUserVote: VoteType | null;
}) {
  const [voteState, setVoteState] = useState<VoteState>({
    userVote: initialUserVote,
    upvotes: initialUpvotes,
    downvotes: initialDownvotes,
  });
  const [optimisticVotes, addOptimisticVote] = useOptimistic(
    voteState,
    applyVote,
  );
  const [isPending, startTransition] = useTransition();
  const [pendingVote, setPendingVote] = useState<VoteType | null>(null);
  const { toast } = useToast();
  const { openAuthModal } = useAuthModal();

  const { userVote } = optimisticVotes;
  const netScore = optimisticVotes.upvotes - optimisticVotes.downvotes;

  const handleVote = (voteType: VoteType) => {
    setPendingVote(voteType);
    startTransition(async () => {
      addOptimisticVote(voteType);
      try {
        const res = await toggleCommentVote(commentId, type, voteType);
        if ("error" in res && res.error === "UNAUTHORIZED") {
          openAuthModal();
          return;
        }
        const nextState = res as {
          userVote: VoteType | null;
          upvotes: number;
          downvotes: number;
        };
        setVoteState(nextState);
        toast("Vote registered!", "success");
      } catch {
        toast("Failed to register vote. Please try again.", "error");
      } finally {
        setPendingVote(null);
      }
    });
  };

  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1">
      <button
        type="button"
        disabled={isPending}
        onClick={() => handleVote("UPVOTE")}
        className={`inline-flex items-center justify-center transition hover:text-green-600 disabled:cursor-not-allowed disabled:opacity-70 ${
          userVote === "UPVOTE" ? "text-green-600" : "text-black-400"
        }`}
        title="Upvote"
      >
        {isPending && pendingVote === "UPVOTE" ? (
          <Loader2 className="animate-spin h-3.5 w-3.5" />
        ) : (
          <ArrowUp className="w-3.5 h-3.5" />
        )}
      </button>

      <span
        className={`text-xs font-bold min-w-[1rem] text-center ${
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
        type="button"
        disabled={isPending}
        onClick={() => handleVote("DOWNVOTE")}
        className={`inline-flex items-center justify-center transition hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-70 ${
          userVote === "DOWNVOTE" ? "text-red-600" : "text-black-400"
        }`}
        title="Downvote"
      >
        {isPending && pendingVote === "DOWNVOTE" ? (
          <Loader2 className="animate-spin h-3.5 w-3.5" />
        ) : (
          <ArrowDown className="w-3.5 h-3.5" />
        )}
      </button>
    </div>
  );
}
