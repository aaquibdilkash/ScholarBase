"use client";

import { Result, User, ResultVote } from "@prisma/client";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";
import ListPageCardShell from "@/components/cards/ListPageCardShell";
import { VoteButton } from "@/components/interactions/VoteButton";
import { deleteResult } from "@/app/actions/results";
import { RichContent } from "@/components/content/RichContent";
import Link from "next/link";

type ResultWithAuthor = Result & {
  author: User & {
    followers?: { followerId: string }[];
  };
  votes: ResultVote[];
  _count: { votes: number; comments: number };
};

const TYPE_LABELS: Record<string, string> = {
  ADMISSION: "Admission Result",
  VACANCY: "Vacancy Result",
  EVENT: "Event Result",
  EXAM: "Exam Result",
  OTHER: "Other Result",
};

export function ResultCard({
  result,
  currentUserId,
}: {
  result: ResultWithAuthor;
  currentUserId?: string;
}) {
  const isOwner = currentUserId === result.authorId;
  const isFollowing = (result.author.followers?.length ?? 0) > 0;
  const userVote: "UPVOTE" | "DOWNVOTE" | null =
    result.votes?.find((v: any) => v.userId === currentUserId)?.voteType ??
    null;
  const upvoteCount =
    result.votes?.filter((v: any) => v.voteType === "UPVOTE").length ?? 0;
  const downvoteCount =
    result.votes?.filter((v: any) => v.voteType === "DOWNVOTE").length ?? 0;
  return (
    <ListPageCardShell
      authorHref={`/scholars/${result.author.id}`}
      authorName={result.author.name || "Scholar"}
      authorId={result.author.id}
      isFollowing={isFollowing}
      authorHandle={result.author.handle || undefined}
      authorAvatarUrl={result.author.avatarUrl || undefined}
      detailPageHref={`/results/${result.id}`}
      managementControls={
        isOwner && (
          <OwnerActionsDropdown
            editHref={`/results/${result.id}/edit`}
            isOwner={true}
            onDelete={async () => {
              await deleteResult(result.id);
            }}
            editLabel="Edit Result"
            deleteLabel="Delete"
          />
        )
      }
      createdDate={result.createdAt}
      editedDate={
        result.updatedAt > result.createdAt ? result.updatedAt : undefined
      }
      footerVoteButton={
        <VoteButton
          targetId={result.id}
          type="result"
          initialUpvotes={upvoteCount}
          initialDownvotes={downvoteCount}
          initialUserVote={userVote}
        />
      }
      footerCommentsHref={`/results/${result.id}`}
      footerCommentsCount={result._count.comments}
      noBodyLink={true}
      bodyBottomContent={
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          {result.notificationLink && (
            <a
              href={result.notificationLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="sb-button-soft flex-1 px-4 py-2 text-center text-xs"
            >
              View Notification
            </a>
          )}
          {result.resultLink && (
            <a
              href={result.resultLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="sb-button-primary flex-1 px-4 py-2 text-center text-xs"
            >
              Check Results
            </a>
          )}
        </div>
      }
    >
      <Link href={`/results/${result.id}`} className="block group">
        <div className="mb-2 flex items-center gap-2">
          <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
            {TYPE_LABELS[result.type] || result.type}
          </span>
          {result.category && (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {result.category}
            </span>
          )}
        </div>

        <h2 className="mb-2 text-lg font-semibold leading-tight text-slate-950">
          {result.title}
        </h2>

        <RichContent
          content={result.description}
          className="text-sm leading-relaxed text-slate-600 line-clamp-3"
        />

        {(result.conductingBody || result.session) && (
          <div className="mt-3 flex flex-wrap gap-3 text-xs font-medium text-slate-500">
            {result.conductingBody && (
              <span>Conducting Body: {result.conductingBody}</span>
            )}
            {result.session && <span>Session: {result.session}</span>}
          </div>
        )}
      </Link>
    </ListPageCardShell>
  );
}
