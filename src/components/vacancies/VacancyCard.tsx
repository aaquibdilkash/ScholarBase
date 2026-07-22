"use client";

import { JobVacancy, User } from "@prisma/client";
import { ClockIcon } from "@/components/icons/ClockIcon";
import ListPageCardShell from "@/components/cards/ListPageCardShell";
import { VoteButton } from "@/components/interactions/VoteButton";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";

type VacancyWithAuthor = JobVacancy & {
  author: User & {
    followers?: { followerId: string }[];
  };
  votes: any[];
  _count: { votes: number; comments: number };
};

export function VacancyCard({
  vacancy,
  currentUserId,
}: {
  vacancy: VacancyWithAuthor;
  currentUserId?: string;
}) {
  const isOwner = currentUserId === vacancy.authorId;
  const isFollowing = (vacancy.author.followers?.length ?? 0) > 0;
  const userVote: "UPVOTE" | "DOWNVOTE" | null =
    vacancy.votes?.find((v: any) => v.userId === currentUserId)?.voteType ??
    null;
  const upvoteCount =
    vacancy.votes?.filter((v: any) => v.voteType === "UPVOTE").length ?? 0;
  const downvoteCount =
    vacancy.votes?.filter((v: any) => v.voteType === "DOWNVOTE").length ?? 0;

  return (
    <ListPageCardShell
      authorHref={`/scholar/${vacancy.author.id}`}
      authorName={vacancy.author.name || "Scholar"}
      authorId={vacancy.author.id}
      isFollowing={isFollowing}
      authorHandle={vacancy.author.handle || undefined}
      authorAvatarUrl={vacancy.author.avatarUrl || undefined}
      detailPageHref={`/vacancies/${vacancy.id}`}
      managementControls={
        isOwner && (
          <OwnerActionsDropdown
            editHref={`/vacancies/${vacancy.id}/edit`}
            isOwner={true}
            editLabel="Edit Vacancy"
            deleteLabel="Delete"
            onDelete={() => {
              // TODO: wire delete action if available
            }}
          />
        )
      }
      createdDate={vacancy.createdAt}
      footerVoteButton={
        <VoteButton
          targetId={vacancy.id}
          type="vacancy"
          initialUpvotes={upvoteCount}
          initialDownvotes={downvoteCount}
          initialUserVote={userVote}
        />
      }
      footerCommentsHref={`/vacancies/${vacancy.id}`}
      footerCommentsCount={vacancy._count.comments}
      bodyBottomContent={
        <div className="flex gap-3 mt-4">
          {vacancy.notificationLink && (
            <a
              href={vacancy.notificationLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex-1 rounded-lg bg-slate-100 py-2 text-center text-xs font-semibold text-slate-700 transition-colors duration-200 hover:bg-slate-200"
            >
              Details
            </a>
          )}

          {vacancy.applyLink && (
            <a
              href={vacancy.applyLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex-1 rounded-lg bg-slate-950 py-2 text-center text-xs font-semibold text-white transition-colors duration-200 hover:bg-slate-800"
            >
              Apply
            </a>
          )}
        </div>
      }
    >
      <h2 className="mb-2 text-lg font-semibold leading-tight text-slate-950 group-hover:text-blue-700 transition-colors">
        {vacancy.title}
      </h2>
      <p className="mb-4 text-sm font-medium text-slate-600">
        {vacancy.institution}
      </p>

      <p className="text-sm leading-relaxed text-slate-600 line-clamp-3">
        {vacancy.description}
      </p>

      <div className="mt-6 flex items-center gap-2 rounded-xl border border-red-100/50 bg-red-50/50 p-2 text-xs font-semibold text-red-600">
        <ClockIcon className="w-4 h-4" />
        Last Date: {new Date(vacancy.deadline).toLocaleDateString("en-US")}
      </div>
    </ListPageCardShell>
  );
}
