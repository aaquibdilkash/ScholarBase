"use client";

import { ResearchEvent, User } from "@prisma/client";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";
import ListPageCardShell from "@/components/cards/ListPageCardShell";
import { VoteButton } from "@/components/interactions/VoteButton";
import { deleteResearchEvent } from "@/app/actions/events";
import { RichContent } from "@/components/content/RichContent";
import Link from "next/link";

type EventWithAuthor = ResearchEvent & {
  author: User & {
    followers?: { followerId: string }[];
  };
  votes: any[];
  _count: { votes: number; comments: number };
};

function getUrgencyBadge(
  deadline: Date | null,
): { label: string; className: string } | null {
  if (!deadline) return null;
  const now = new Date();
  const diffDays = Math.ceil(
    (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diffDays < 0)
    return {
      label: "Registration Closed",
      className: "bg-red-100 text-red-700",
    };
  if (diffDays <= 3)
    return {
      label: "Closing Soon",
      className: "bg-orange-100 text-orange-700",
    };
  if (diffDays <= 7)
    return { label: "Week Left", className: "bg-amber-100 text-amber-700" };
  return null;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function EventCard({
  event,
  currentUserId,
}: {
  event: EventWithAuthor;
  currentUserId?: string;
}) {
  const isOwner = currentUserId === event.authorId;
  const isFollowing = (event.author.followers?.length ?? 0) > 0;
  const userVote: "UPVOTE" | "DOWNVOTE" | null =
    event.votes?.find((v: any) => v.userId === currentUserId)?.voteType ?? null;
  const upvoteCount =
    event.votes?.filter((v: any) => v.voteType === "UPVOTE").length ?? 0;
  const downvoteCount =
    event.votes?.filter((v: any) => v.voteType === "DOWNVOTE").length ?? 0;
  const urgency = getUrgencyBadge(event.deadline);

  return (
    <ListPageCardShell
      authorHref={`/scholar/${event.author.id}`}
      authorName={event.author.name || "Scholar"}
      authorId={event.author.id}
      isFollowing={isFollowing}
      authorHandle={event.author.handle || undefined}
      authorAvatarUrl={event.author.avatarUrl || undefined}
      detailPageHref={`/events/${event.id}`}
      managementControls={
        isOwner && (
          <OwnerActionsDropdown
            editHref={`/events/${event.id}/edit`}
            isOwner={true}
            onDelete={async () => {
              await deleteResearchEvent(event.id);
            }}
            editLabel="Edit Event"
            deleteLabel="Delete"
          />
        )
      }
      createdDate={event.createdAt}
      footerVoteButton={
        <VoteButton
          targetId={event.id}
          type="event"
          initialUpvotes={upvoteCount}
          initialDownvotes={downvoteCount}
          initialUserVote={userVote}
        />
      }
      footerCommentsHref={`/events/${event.id}`}
      footerCommentsCount={event._count.comments}
      noBodyLink={true}
      bodyBottomContent={
        <div className="flex gap-3 mt-4">
          {event.notificationLink && (
            <a
              href={event.notificationLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 rounded-lg bg-slate-100 py-2 text-center text-xs font-semibold text-slate-700 transition-colors duration-200 hover:bg-slate-200"
            >
              View Brochure
            </a>
          )}
          {event.applyLink && (
            <a
              href={event.applyLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 rounded-lg bg-slate-950 py-2 text-center text-xs font-semibold text-white transition-colors duration-200 hover:bg-slate-800"
            >
              Register Now
            </a>
          )}
        </div>
      }
    >
      <Link href={`/events/${event.id}`} className="block group">
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
          {event.title}
        </h2>

        <div className="mb-3 space-y-1.5">
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
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <span className="font-medium">{formatDate(event.date)}</span>
          </div>
          {event.location && (
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
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <span>{event.location}</span>
            </div>
          )}
          {event.deadline && (
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
                  {formatDate(event.deadline)}
                </span>
              </span>
            </div>
          )}
        </div>

        <RichContent
          content={event.description}
          className="text-sm leading-relaxed text-slate-600 line-clamp-3"
        />
      </Link>
    </ListPageCardShell>
  );
}
