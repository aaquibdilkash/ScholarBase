"use client";

import { useOptimistic, useState, useTransition } from "react";
import { toggleCommentVote } from "@/app/actions/votes";
import { ArrowDown, ArrowUp, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { useAuthModal } from "./AuthModal";
import type { CommentEntityType } from "@/types/comments";
import type { VoteType } from "@/types/votes";

type CommentVoteState = {
   userVote: VoteType | null;
   totalVotes: number;
 };

  function applyCommentVote(state: CommentVoteState, voteType: VoteType): CommentVoteState {
    if (state.userVote === voteType) {
      return {
        userVote: null,
        totalVotes: state.totalVotes + (voteType === "UPVOTE" ? -1 : 1),
      };
    }

    if (state.userVote) {
      return {
        userVote: voteType,
        totalVotes: state.totalVotes + (voteType === "UPVOTE" ? 2 : -2),
      };
    }

    return {
      userVote: voteType,
      totalVotes: state.totalVotes + (voteType === "UPVOTE" ? 1 : -1),
    };
  }

 
export function CommentVoteButton({
  commentId,
  type,
  initialTotalVotes,
  initialUserVote,
}: {
  commentId: string;
  type: CommentEntityType;
  initialTotalVotes: number;
  initialUserVote: VoteType | null;
}) {
  const [voteState, setVoteState] = useState<CommentVoteState>({
    userVote: initialUserVote,
    totalVotes: initialTotalVotes,
  });
  const [optimisticVotes, addOptimisticVote] = useOptimistic(
    voteState,
    applyCommentVote,
  );
  const [isPending, startTransition] = useTransition();
  const [pendingVote, setPendingVote] = useState<VoteType | null>(null);
  const { toast } = useToast();
  const { openAuthModal } = useAuthModal();

  const { userVote, totalVotes } = optimisticVotes;

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
        if (res.success && typeof res.data?.totalVotes === 'number') {
          setVoteState(prev => ({
            totalVotes: res.data!.totalVotes,
            userVote: applyCommentVote(prev, voteType).userVote,
          }));
          toast({
            title: "Success",
            description: res.data.userVote ? "Vote registered!" : "Vote removed.",
          });
        } else {
          toast({
            title: "Error",
            description: "Failed to register vote. Please try again.",
            variant: "destructive",
          });
        }
      } catch {
        toast({
          title: "Error",
          description: "Failed to register vote. Please try again.",
          variant: "destructive",
        });
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
          totalVotes > 0
            ? "text-green-600"
            : totalVotes < 0
              ? "text-red-600"
              : "text-black-500"
        }`}
      >
        {totalVotes}
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
