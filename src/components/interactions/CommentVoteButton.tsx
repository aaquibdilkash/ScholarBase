"use client";

import { useState, useTransition } from "react";
import { toggleCommentVote } from "@/app/actions/comments";
import { VoteArrowIcon } from "../icons/VoteIcons";

type VoteType = "UPVOTE" | "DOWNVOTE";

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
    | "journal"
    | "result";
  initialUpvotes: number;
  initialDownvotes: number;
  initialUserVote: VoteType | null;
}) {
  const [userVote, setUserVote] = useState<VoteType | null>(initialUserVote);
  const [upvotes, setUpvotes] = useState(initialUpvotes);
  const [downvotes, setDownvotes] = useState(initialDownvotes);
  const [isPending, startTransition] = useTransition();

  const netScore = upvotes - downvotes;

  const handleVote = (voteType: VoteType) => {
    startTransition(async () => {
      const prevVote = userVote;
      const prevUpvotes = upvotes;
      const prevDownvotes = downvotes;

      // Optimistic update
      if (userVote === voteType) {
        setUserVote(null);
        if (voteType === "UPVOTE") setUpvotes((c) => c - 1);
        else setDownvotes((c) => c - 1);
      } else {
        if (userVote === "UPVOTE") setUpvotes((c) => c - 1);
        if (userVote === "DOWNVOTE") setDownvotes((c) => c - 1);

        setUserVote(voteType);
        if (voteType === "UPVOTE") setUpvotes((c) => c + 1);
        else setDownvotes((c) => c + 1);
      }

      try {
        const res = await toggleCommentVote(commentId, type, voteType);
        setUserVote(res.userVote);
        setUpvotes(res.upvotes);
        setDownvotes(res.downvotes);
      } catch {
        setUserVote(prevVote);
        setUpvotes(prevUpvotes);
        setDownvotes(prevDownvotes);
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
        <VoteArrowIcon direction="up" className="w-3.5 h-3.5" />
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
        <VoteArrowIcon direction="down" className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
