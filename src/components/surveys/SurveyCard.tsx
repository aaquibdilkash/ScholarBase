"use client";

import { ResearchSurvey, User } from "@prisma/client";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";
import ListPageCardShell from "@/components/cards/ListPageCardShell";
import { VoteButton } from "@/components/interactions/VoteButton";
import { deleteSurvey } from "@/app/actions/surveys";

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
      authorHref={`/scholar/${survey.author.id}`}
      authorName={survey.author.name || "Scholar"}
      authorId={survey.author.id}
      isFollowing={isFollowing}
      authorHandle={survey.author.handle || undefined}
      authorAvatarUrl={survey.author.avatarUrl || undefined}
      detailPageHref={`/surveys/${survey.id}`}
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
        <p className="text-sm leading-relaxed text-slate-600 line-clamp-3">
          {survey.description}
        </p>
      )}

      {survey.shareData && (
        <div className="mt-3 flex items-center gap-1 text-xs font-medium text-green-600">
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
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          Data available for sharing
        </div>
      )}
    </ListPageCardShell>
  );
}
