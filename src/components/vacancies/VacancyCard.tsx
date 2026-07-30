"use client";

import { JobVacancy, User } from "@prisma/client";
import { ClockIcon } from "@/components/icons/ClockIcon";
import ListPageCardShell from "@/components/cards/ListPageCardShell";
import { VoteButton } from "@/components/interactions/VoteButton";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";
import { RichContent } from "@/components/content/RichContent";

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

      <RichContent
        content={vacancy.description}
        className="text-sm leading-relaxed text-slate-600 line-clamp-3"
      />

      <div className="mt-4 flex items-center gap-2 text-sm text-slate-600">
        <svg className="h-4 w-4 shrink-0 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>
            Last Date:{" "}
            <span className="font-medium">
                {new Date(vacancy.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </span>
        </span>
      </div>
    </ListPageCardShell>
  );
}
