"use client";

import { useQueryClient } from "@tanstack/react-query";
import { removeFromList } from "@/utils/cacheMutation";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";
import ListPageCardShell from "@/components/cards/ListPageCardShell";
import { ReportMenu } from "@/components/cards/ReportMenu";
import { VoteButton } from "@/components/interactions/VoteButton";
import { BookmarkButton } from "@/components/interactions/BookmarkButton";
import { deleteCallForPaper } from "@/app/actions/call-for-papers";
import { useToast } from "@/components/ui/Toast";
import { actionErrorMessage } from "@/lib/utils";
import { SmartExternalLink } from "@/components/ui/SmartExternalLink";
import { SafeExternalLink } from "@/components/ui/SafeExternalLink";
import Link from "next/link";
import { getTimeLeft } from "@/utils/time-ago";
import { formatDate } from "@/utils/date";
import { Calendar, Clock, MapPin } from "lucide-react";
import type { CallForPaperWithAuthor } from "@/types/cards";
import { RichContent } from "../content/RichContent";
import { getCallForPaperCategoryLabel } from "@/lib/call-for-papers";

export function CallForPaperCard({
  event,
  currentUserId,
}: {
  event: CallForPaperWithAuthor;
  currentUserId?: string;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isOwner = currentUserId === event.authorId;
  const isFollowing = (event.author?.followers?.length ?? 0) > 0;
  const userVote: "UPVOTE" | "DOWNVOTE" | null =
    (event.votes || [])[0]?.voteType ?? null;
  const urgency = getTimeLeft(event.deadline);
  // Share payload: mirror events/[id]/page.tsx generateMetadata().
  const shareTitle = event.title;
  const eventLocation = event.location ? ` at ${event.location}` : "";
  const shareText = `Call for papers${eventLocation}. ${
    event.eventDate
      ? new Date(event.eventDate).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : "Date to be announced"
  }.`;

  return (
    <ListPageCardShell
      // The list card must surface the same moderation state as /call-for-papers/[id].
      isFrozen={event.isFrozen ?? false}
      frozenEntityId={event.id}
      frozenModule="CALL_FOR_PAPER"
      frozenEntityType="POST"
      frozenOwnerId={event.author?.id ?? null}
      frozenHasActiveAppeal={event.hasActiveAppeal ?? false}
      authorHref={`/scholars/${event.author?.id}`}
      authorName={event.author?.name || "Scholar"}
      authorId={event.authorId}
      isFollowing={isFollowing}
      currentUserId={currentUserId}
      authorHandle={event.author?.handle || undefined}
      authorAvatarUrl={event.author?.avatarUrl || undefined} authorVerified={!!(event.author?.institutionVerifiedAt)}
      detailPageHref={`/call-for-papers/${event.id}`}
      shareTitle={shareTitle}
      shareText={shareText}
      managementControls={
        isOwner && (
          <OwnerActionsDropdown
            editHref={`/call-for-papers/${event.id}/edit`}
            isOwner={true}
            onDelete={async () => {
              try {
                const response = await deleteCallForPaper(event.id);
                if (!response?.success || !response.data) {
                  toast(actionErrorMessage(response, "Failed to delete event."), "error");
                  return { refresh: false };
                }
                removeFromList<CallForPaperWithAuthor>(queryClient, ["call-for-papers"], response.data.deletedId);
                toast("Event deleted successfully.", "success");
                return { refresh: false };
              } catch (error) {
                const message = error instanceof Error ? error.message : "Unknown error";
                toast(message, "error");
                return { refresh: false };
              }
            }}
            editLabel="Edit Call for Papers"
            deleteLabel="Delete"
          />
        )
      }
      createdDate={event.createdAt}
      editedDate={
        event.editedAt && event.editedAt > event.createdAt ? event.editedAt : undefined
      }
      footerVoteButton={
        <VoteButton
          frozen={event.isFrozen === true}
          targetId={event.id}
          module="CALL_FOR_PAPER"
          initialTotalVotes={event.totalVotes}
          initialUserVote={userVote}
          isOwnContent={isOwner}
        />
      }
      footerBookmarkButton={
        <BookmarkButton
          frozen={event.isFrozen === true}
          targetId={event.id}
          module="CALL_FOR_PAPER"
          initialTotalBookmarks={event.totalBookmarks ?? 0}
          initialIsBookmarked={Array.isArray(event.bookmarks) && event.bookmarks.length > 0}
        />
      }
      footerCommentsHref={`/call-for-papers/${event.id}`}
      footerCommentsCount={event.totalComments}
      footerReportMenu={
        <ReportMenu
          entityId={event.id}
          entityType="POST"
          module="CALL_FOR_PAPER"
          ownerId={event.author?.id ?? event.authorId ?? null}
          currentUserId={currentUserId ?? null}
          isFrozen={event.isFrozen ?? false}
          hasActiveAppeal={event.hasActiveAppeal ?? false}
        />
      }
      noBodyLink={true}
      constrainBody={true}
      bodyBottomContent={
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <SafeExternalLink
            url={event.notificationLink}
            className="sb-button-soft flex-1 px-4 py-2 text-center text-xs"
          >
            View Brochure
          </SafeExternalLink>
          <SmartExternalLink
            url={event.applyLink}
            className="sb-button-primary flex-1 px-4 py-2 text-center text-xs"
            urlLabel="Register Now"
            emailLabel="Email to Register"
          />
        </div>
      }
    >
      <Link href={`/call-for-papers/${event.id}`} prefetch={false} className="block group">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {urgency && (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${urgency.className}`}
            >
              <Clock className="h-3 w-3" />
              {urgency.label}
            </span>
          )}
          <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
            {getCallForPaperCategoryLabel(event.category)}
          </span>
        </div>

        <h2 className="mb-2 break-words [overflow-wrap:anywhere] text-lg font-semibold leading-tight text-slate-950 transition-colors group-hover:text-blue-700 dark:text-slate-50 dark:group-hover:text-blue-300">
          {event.title}
        </h2>
        {(event.publisher || event.journal) && (
          <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
            {event.journal?.title ?? event.publisher}
            {event.journal?.title && event.publisher ? ` · ${event.publisher}` : ""}
          </p>
        )}

        <div className="mb-3 space-y-1.5">
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <Calendar className="h-4 w-4 shrink-0 text-slate-400" />
            <span className="font-medium">
              {event.eventDate ? formatDate(event.eventDate) : "Date not specified"}
            </span>
          </div>
          {event.location && (
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <MapPin className="h-4 w-4 shrink-0 text-slate-400" />
              <span className="break-words [overflow-wrap:anywhere]">{event.location}</span>
            </div>
          )}
          {event.deadline && (
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
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
          className="text-sm leading-relaxed text-slate-600 dark:text-slate-300"
        />
      </Link>
    </ListPageCardShell>
  );
}
