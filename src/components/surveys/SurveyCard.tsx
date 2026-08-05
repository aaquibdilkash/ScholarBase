"use client";

import { ResearchSurvey, User } from "@prisma/client";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";
import ListPageCardShell from "@/components/cards/ListPageCardShell";
import { VoteButton } from "@/components/interactions/VoteButton";
import { RichContent } from "@/components/content/RichContent";
import { deleteSurvey } from "@/app/actions/surveys";
import Link from "next/link";

type SurveyWithDetails = ResearchSurvey & {
  author: User & {
    followers?: { followerId: string }[];
  };
  votes: any[];
  _count: { votes: number; comments: number; responses: number };
};

const PRIVACY_LABELS: Record<string, string> = {
  ANONYMOUS: "Anonymous",
  NON_ANONYMOUS: "Non-Anonymous",
  HYBRID: "Hybrid",
};

const STATUS_BADGES: Record<string, string> = {
  OPEN: "bg-green-100 text-green-700",
  CLOSED: "bg-red-100 text-red-700",
};

export function SurveyCard({
  survey,
  currentUserId,
}: {
  survey: SurveyWithDetails;
  currentUserId?: string;
}) {
  const isOwner = currentUserId === survey.authorId;
  const isFollowing = (survey.author.followers?.length ?? 0) > 0;
  const userVote: "UPVOTE" | "DOWNVOTE" | null =
    survey.votes?.find((v: any) => v.userId === currentUserId)?.voteType ??
    null;
  const upvoteCount =
    survey.votes?.filter((v: any) => v.voteType === "UPVOTE").length ?? 0;
  const downvoteCount =
    survey.votes?.filter((v: any) => v.voteType === "DOWNVOTE").length ?? 0;

  return (
    <ListPageCardShell
      authorHref={`/scholars/${survey.author.id}`}
      authorName={survey.author.name || "Scholar"}
      authorId={survey.author.id}
      isFollowing={isFollowing}
      currentUserId={currentUserId}
      authorHandle={survey.author.handle || undefined}
      authorAvatarUrl={survey.author.avatarUrl || undefined}
      detailPageHref={`/surveys/${survey.id}`}
      noBodyLink={true}
      managementControls={
        isOwner && (
          <OwnerActionsDropdown
            editHref={`/surveys/${survey.id}/edit`}
            isOwner={true}
            onDelete={async () => {
              await deleteSurvey(survey.id);
            }}
            editLabel="Edit Survey"
            deleteLabel="Delete"
          />
        )
      }
      createdDate={survey.createdAt}
      editedDate={
        survey.updatedAt > survey.createdAt ? survey.updatedAt : undefined
      }
      footerVoteButton={
        <VoteButton
          targetId={survey.id}
          type="survey"
          initialUpvotes={upvoteCount}
          initialDownvotes={downvoteCount}
          initialUserVote={userVote}
        />
      }
      footerCommentsHref={`/surveys/${survey.id}`}
      footerCommentsCount={survey._count.comments}
    >
      <Link href={`/surveys/${survey.id}`} className="block group">
        <div className="mb-2 flex items-center gap-2">
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              STATUS_BADGES[survey.status] || "bg-slate-100 text-slate-600"
            }`}
          >
            {survey.status}
          </span>
          <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-700">
            {PRIVACY_LABELS[survey.privacy] || survey.privacy}
          </span>
          <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
            {survey._count.responses} response
            {survey._count.responses !== 1 ? "s" : ""}
          </span>
        </div>

        <h2 className="mb-2 text-lg font-semibold leading-tight text-slate-950">
          {survey.title}
        </h2>

        {survey.description && (
          <RichContent
            content={survey.description}
            className="text-sm leading-relaxed text-slate-600 line-clamp-3"
          />
        )}
      </Link>
      {survey.shareData && (
        <Link
          href={`/surveys/${survey.id}/results`}
          className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          Data available for sharing — view results
        </Link>
      )}
    </ListPageCardShell>
  );
}
