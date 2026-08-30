"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";
import ListPageCardShell from "@/components/cards/ListPageCardShell";
import { ReportMenu } from "@/components/cards/ReportMenu";
import { VoteButton } from "@/components/interactions/VoteButton";
import { deleteResearchEvent } from "@/app/actions/events";
import { useToast } from "@/components/ui/Toast";
import { RichContent } from "@/components/content/RichContent";
import Link from "next/link";
import { getTimeLeft } from "@/utils/time-ago";
import { Calendar, Clock, MapPin } from "lucide-react";
import type { EventWithAuthor } from "@/types/cards";

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
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isOwner = currentUserId === event.authorId;
  const isFollowing = (event.author?.followers?.length ?? 0) > 0;
  const userVote: "UPVOTE" | "DOWNVOTE" | null =
    (event.votes || [])[0]?.voteType ?? null;
  const urgency = getTimeLeft(event.deadline);

  const deleteMutation = useMutation({
    mutationFn: deleteResearchEvent,
    onSuccess: (response) => {
      if (!response.success || !response.data) {
        toast("Failed to delete event.", "error");
        return;
      }
      queryClient.setQueriesData(
        { queryKey: ["events"] },
        (oldData: EventWithAuthor[] = []) =>
          oldData.filter((e) => e.id !== response.data.deletedId),
      );
      toast("Event deleted successfully.", "success");
    },
    onError: (error) => toast(error.message, "error"),
  });

  return (
    <ListPageCardShell
      authorHref={`/scholars/${event.author?.id}`}
      authorName={event.author?.name || "Scholar"}
      authorId={event.author?.id}
      isFollowing={isFollowing}
      currentUserId={currentUserId}
      authorHandle={event.author?.handle || undefined}
      authorAvatarUrl={event.author?.avatarUrl || undefined}
      detailPageHref={`/events/${event.id}`}
      managementControls={
        isOwner && (
          <OwnerActionsDropdown
            editHref={`/events/${event.id}/edit`}
            isOwner={true}
            onDelete={() => {
              deleteMutation.mutate(event.id);
              return { refresh: false };
            }}
            editLabel="Edit Event"
            deleteLabel="Delete"
          />
        )
      }
      createdDate={event.createdAt}
      footerVoteButton={
        <VoteButton
          frozen={event.isFrozen === true}
          targetId={event.id}
          module="RESEARCH_EVENT"
          initialTotalVotes={event.totalVotes ?? 0}
          initialUserVote={userVote}
        />
      }
      footerCommentsHref={`/events/${event.id}`}
      footerCommentsCount={event.totalComments}
      footerReportMenu={
        <ReportMenu entityId={event.id} entityType="POST" module="RESEARCH_EVENT" contentType="event" />
      }
      noBodyLink={true}
      bodyBottomContent={
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          {event.notificationLink && (
            <a
              href={event.notificationLink}
              target="_blank"
              rel="noopener noreferrer"
              className="sb-button-soft flex-1 px-4 py-2 text-center text-xs"
            >
              View Brochure
            </a>
          )}
          {event.applyLink && (
            <a
              href={event.applyLink}
              target="_blank"
              rel="noopener noreferrer"
              className="sb-button-primary flex-1 px-4 py-2 text-center text-xs"
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
              <Clock className="h-3 w-3" />
              {urgency.label}
            </span>
          )}
        </div>

        <h2 className="mb-2 text-lg font-semibold leading-tight text-slate-950">
          {event.title}
        </h2>

        <div className="mb-3 space-y-1.5">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Calendar className="h-4 w-4 shrink-0 text-slate-400" />
            <span className="font-medium">{formatDate(event.date)}</span>
          </div>
          {event.location && (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <MapPin className="h-4 w-4 shrink-0 text-slate-400" />
              <span>{event.location}</span>
            </div>
          )}
          {event.deadline && (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Clock className="h-4 w-4 shrink-0 text-slate-400" />
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
