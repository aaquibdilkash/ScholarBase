"use client";

import { Contribution, User } from "@prisma/client";
import ListPageCardShell from "@/components/cards/ListPageCardShell";
import { VoteButton } from "@/components/interactions/VoteButton";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";
import { deleteContribution } from "@/app/actions/contributions";
import { useState } from "react";

type ContributionWithAuthor = Contribution & {
  author: User & {
    followers?: { followerId: string }[];
  };
  votes: any[];
  _count: { votes: number; comments: number };
};

export function ContributionCard({
  contribution,
  currentUserId,
}: {
  contribution: ContributionWithAuthor;
  currentUserId?: string;
}) {
  const [showReason, setShowReason] = useState(false);
  const isOwner = currentUserId === contribution.authorId;
  const isFollowing = (contribution.author.followers?.length ?? 0) > 0;
  const userVote: "UPVOTE" | "DOWNVOTE" | null =
    contribution.votes?.find((v: any) => v.userId === currentUserId)
      ?.voteType ?? null;
  const upvoteCount =
    contribution.votes?.filter((v: any) => v.voteType === "UPVOTE").length ?? 0;
  const downvoteCount =
    contribution.votes?.filter((v: any) => v.voteType === "DOWNVOTE").length ??
    0;

  return (
    <ListPageCardShell
      authorHref={`/scholars/${contribution.author.id}`}
      authorName={contribution.author.name || "Scholar"}
      authorId={contribution.author.id}
      isFollowing={isFollowing}
      authorHandle={contribution.author.handle || undefined}
      authorAvatarUrl={contribution.author.avatarUrl || undefined}
      detailPageHref={`/contributions/${contribution.id}`}
      managementControls={
        isOwner && (
          <OwnerActionsDropdown
            editHref={`/contributions/${contribution.id}/edit`}
            isOwner={true}
            editLabel="Edit Contribution"
            deleteLabel="Delete"
            onDelete={() => {
              deleteContribution(contribution.id);
            }}
          />
        )
      }
      createdDate={contribution.createdAt}
      editedDate={
        contribution.updatedAt > contribution.createdAt
          ? contribution.updatedAt
          : undefined
      }
      footerVoteButton={
        <VoteButton
          targetId={contribution.id}
          type="contribution"
          initialUpvotes={upvoteCount}
          initialDownvotes={downvoteCount}
          initialUserVote={userVote}
        />
      }
      footerCommentsHref={`/contributions/${contribution.id}`}
      footerCommentsCount={contribution._count.comments}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            contribution.status === "APPROVED"
              ? "bg-green-100 text-green-700"
              : contribution.status === "PENDING"
                ? "bg-amber-100 text-amber-700"
                : "bg-red-100 text-red-700"
          }`}
        >
          {contribution.status}
        </span>
        {contribution.amount && (
          <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
            ₹{contribution.amount}
          </span>
        )}
      </div>

      {contribution.status === "REJECTED" &&
        (contribution as any).rejectionReason && (
          <div className="mb-3">
            <button
              onClick={() => setShowReason(!showReason)}
              className="flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-700 transition"
            >
              <svg
                className={`h-3 w-3 transition-transform ${showReason ? "rotate-90" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 5l7 7-7 7"
                />
              </svg>
              Why was this rejected?
            </button>
            {showReason && (
              <div className="mt-2 rounded-xl border border-red-100 bg-red-50 p-3 text-xs text-red-700">
                {(contribution as any).rejectionReason}
              </div>
            )}
          </div>
        )}

      <h2 className="mb-2 text-lg font-semibold leading-tight text-slate-950 group-hover:text-blue-700 transition-colors">
        {contribution.title}
      </h2>

      <p className="text-sm leading-relaxed text-slate-600 line-clamp-3">
        {contribution.message}
      </p>
    </ListPageCardShell>
  );
}
