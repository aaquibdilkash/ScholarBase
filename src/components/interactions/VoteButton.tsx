"use client";

import { toggleVote } from "@/app/actions/interactions";
import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { useAuthModal } from "./AuthModal";

export type VoteType = "UPVOTE" | "DOWNVOTE";
export type VoteTargetType =
  | "article"
  | "post"
  | "vacancy"
  | "admission"
  | "event"
  | "supervisor"
  | "recommendation"
  | "help"
  | "journal"
  | "researchTool"
  | "result"
  | "contribution"
  | "publication"
  | "survey";

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
  const [userVote, setUserVote] = useState<VoteType | null>(initialUserVote);
  const [upvotes, setUpvotes] = useState(initialUpvotes);
  const [downvotes, setDownvotes] = useState(initialDownvotes);
  const { toast } = useToast();
  const { openAuthModal } = useAuthModal();

  const netScore = upvotes - downvotes;

  const handleVote = (voteType: VoteType) => {
    setPendingVote(voteType);
    startTransition(async () => {
      const prevVote = userVote;
      const prevUpvotes = upvotes;
      const prevDownvotes = downvotes;

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
        const result = (await toggleVote(targetId, type, voteType)) as any;
        if (result?.error === "UNAUTHORIZED") {
          setUserVote(prevVote);
          setUpvotes(prevUpvotes);
          setDownvotes(prevDownvotes);
          openAuthModal();
          return;
        }
        setUserVote(result.userVote);
        setUpvotes(result.upvotes);
        setDownvotes(result.downvotes);
        toast("Vote registered!", "success");
      } catch {
        setUserVote(prevVote);
        setUpvotes(prevUpvotes);
        setDownvotes(prevDownvotes);
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
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
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
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        ) : (
          <ArrowDown
            className={`w-4 h-4 ${userVote === "DOWNVOTE" ? "text-red-600" : ""}`}
          />
        )}
      </button>
    </div>
  );
}
