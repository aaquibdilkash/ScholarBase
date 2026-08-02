"use client";

import { PhdAdmission, User } from "@prisma/client";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";
import ListPageCardShell from "@/components/cards/ListPageCardShell";
import { VoteButton } from "@/components/interactions/VoteButton";
import { deletePhdAdmission } from "@/app/actions/admissions";
import { RichContent } from "@/components/content/RichContent";
import Link from "next/link";

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

type AdmissionWithAuthor = PhdAdmission & {
  author: User & {
    followers?: { followerId: string }[];
  };
  votes: any[];
  _count: { votes: number; comments: number };
};

function getUrgencyBadge(
  deadline: Date,
): { label: string; className: string } | null {
  const now = new Date();
  const diffDays = Math.ceil(
    (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diffDays < 0)
    return { label: "Closed", className: "bg-red-100 text-red-700" };
  if (diffDays <= 7)
    return {
      label: "Closing Soon",
      className: "bg-orange-100 text-orange-700",
    };
  if (diffDays <= 30)
    return { label: "Month Left", className: "bg-amber-100 text-amber-700" };
  return null;
}

export function AdmissionCard({
  admission,
  currentUserId,
}: {
  admission: AdmissionWithAuthor;
  currentUserId?: string;
}) {
  const isOwner = currentUserId === admission.authorId;
  const isFollowing = (admission.author.followers?.length ?? 0) > 0;
  const userVote: "UPVOTE" | "DOWNVOTE" | null =
    admission.votes?.find((v: any) => v.userId === currentUserId)?.voteType ??
    null;
  const upvoteCount =
    admission.votes?.filter((v: any) => v.voteType === "UPVOTE").length ?? 0;
  const downvoteCount =
    admission.votes?.filter((v: any) => v.voteType === "DOWNVOTE").length ?? 0;
  const urgency = getUrgencyBadge(admission.deadline);

  return (
    <ListPageCardShell
      authorHref={`/scholars/${admission.author.id}`}
      authorName={admission.author.name || "Scholar"}
      authorId={admission.author.id}
      isFollowing={isFollowing}
      authorHandle={admission.author.handle || undefined}
      authorAvatarUrl={admission.author.avatarUrl || undefined}
      detailPageHref={`/admissions/${admission.id}`}
      managementControls={
        isOwner && (
          <OwnerActionsDropdown
            editHref={`/admissions/${admission.id}/edit`}
            isOwner={true}
            onDelete={async () => {
              await deletePhdAdmission(admission.id);
            }}
            editLabel="Edit Admission"
            deleteLabel="Delete"
          />
        )
      }
      createdDate={admission.createdAt}
      footerVoteButton={
        <VoteButton
          targetId={admission.id}
          type="admission"
          initialUpvotes={upvoteCount}
          initialDownvotes={downvoteCount}
          initialUserVote={userVote}
        />
      }
      footerCommentsHref={`/admissions/${admission.id}`}
      footerCommentsCount={admission._count.comments}
      noBodyLink={true}
      bodyBottomContent={
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          {admission.notificationLink && (
            <a
              href={admission.notificationLink}
              target="_blank"
              rel="noopener noreferrer"
              className="sb-button-soft flex-1 px-4 py-2 text-center text-xs"
            >
              View Circular
            </a>
          )}
          {admission.applyLink && (
            <a
              href={admission.applyLink}
              target="_blank"
              rel="noopener noreferrer"
              className="sb-button-primary flex-1 px-4 py-2 text-center text-xs"
            >
              Go to Portal
            </a>
          )}
        </div>
      }
    >
      <Link href={`/admissions/${admission.id}`} className="block group">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {urgency && (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${urgency.className}`}
            >
              <svg
                className="h-3 w-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.5"
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              {urgency.label}
            </span>
          )}
        </div>

        <h2 className="mb-2 text-lg font-semibold leading-tight text-slate-950">
          {admission.university}
        </h2>

        <div className="mb-3 space-y-1.5">
          <p className="text-sm font-semibold text-blue-700">
            {admission.department}
          </p>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <svg
              className="h-4 w-4 shrink-0 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>
              Deadline:{" "}
              <span className="font-medium">
                {formatDate(admission.deadline)}
              </span>
            </span>
          </div>
        </div>

        <RichContent
          content={admission.description}
          className="text-sm leading-relaxed text-slate-600 line-clamp-3"
        />
      </Link>
    </ListPageCardShell>
  );
}
