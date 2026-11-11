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
import { CollapsibleMediaBody } from "@/components/cards/CollapsibleMediaBody";
import { getTimeLeft } from "@/utils/time-ago";
import { formatDate } from "@/utils/date";
import { Calendar, Clock, MapPin } from "lucide-react";
import type { CallForPaperWithAuthor } from "@/types/cards";
import { RichContent } from "../content/RichContent";
import { getCallForPaperCategoryLabel } from "@/lib/call-for-papers";

export function CallForPaperCard({
  callForPaper,
  currentUserId,
}: {
  callForPaper: CallForPaperWithAuthor;
  currentUserId?: string;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isOwner = currentUserId === callForPaper.authorId;
  const isFollowing = (callForPaper.author?.followers?.length ?? 0) > 0;
  const userVote: "UPVOTE" | "DOWNVOTE" | null =
    (callForPaper.votes || [])[0]?.voteType ?? null;
  const urgency = getTimeLeft(callForPaper.deadline);
  // Share payload: mirror events/[id]/page.tsx generateMetadata().
  const shareTitle = callForPaper.title;
  const eventLocation = callForPaper.location ? ` at ${callForPaper.location}` : "";
  const shareText = `Call for papers${eventLocation}. ${
    callForPaper.eventDate
      ? new Date(callForPaper.eventDate).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : "Date to be announced"
  }.`;

  return (
    <ListPageCardShell
      // The list card must surface the same moderation state as /call-for-papers/[id].
      isFrozen={callForPaper.isFrozen ?? false}
      frozenEntityId={callForPaper.id}
      frozenModule="CALL_FOR_PAPER"
      frozenEntityType="POST"
      frozenOwnerId={callForPaper.author?.id ?? null}
      frozenHasActiveAppeal={callForPaper.hasActiveAppeal ?? false}
      authorHref={`/scholars/${callForPaper.author?.id}`}
      authorName={callForPaper.author?.name || "Scholar"}
      authorId={callForPaper.authorId}
      isFollowing={isFollowing}
      currentUserId={currentUserId}
      authorHandle={callForPaper.author?.handle || undefined}
      authorAvatarUrl={callForPaper.author?.avatarUrl || undefined} authorVerified={!!(callForPaper.author?.institutionVerifiedAt)}
      detailPageHref={`/call-for-papers/${callForPaper.id}`}
      shareTitle={shareTitle}
      shareText={shareText}
      managementControls={
        isOwner && (
          <OwnerActionsDropdown
            editHref={`/call-for-papers/${callForPaper.id}/edit`}
            isOwner={true}
            onDelete={async () => {
              try {
                const response = await deleteCallForPaper(callForPaper.id);
                if (!response?.success || !response.data) {
                  toast(actionErrorMessage(response, "Failed to delete callForPaper."), "error");
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
      createdDate={callForPaper.createdAt}
      editedDate={
        callForPaper.editedAt && callForPaper.editedAt > callForPaper.createdAt ? callForPaper.editedAt : undefined
      }
      footerVoteButton={
        <VoteButton
          frozen={callForPaper.isFrozen === true}
          targetId={callForPaper.id}
          module="CALL_FOR_PAPER"
          initialTotalVotes={callForPaper.totalVotes}
          initialUserVote={userVote}
          isOwnContent={isOwner}
        />
      }
      footerBookmarkButton={
        <BookmarkButton
          frozen={callForPaper.isFrozen === true}
          targetId={callForPaper.id}
          module="CALL_FOR_PAPER"
          initialTotalBookmarks={callForPaper.totalBookmarks ?? 0}
          initialIsBookmarked={Array.isArray(callForPaper.bookmarks) && callForPaper.bookmarks.length > 0}
        />
      }
      footerCommentsHref={`/call-for-papers/${callForPaper.id}`}
      footerCommentsCount={callForPaper.totalComments}
      footerReportMenu={
        <ReportMenu
          entityId={callForPaper.id}
          entityType="POST"
          module="CALL_FOR_PAPER"
          ownerId={callForPaper.author?.id ?? callForPaper.authorId ?? null}
          currentUserId={currentUserId ?? null}
          isFrozen={callForPaper.isFrozen ?? false}
          hasActiveAppeal={callForPaper.hasActiveAppeal ?? false}
        />
      }
      noBodyLink={true}
      constrainBody={false}
      bodyBottomContent={
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <SafeExternalLink
            url={callForPaper.notificationLink}
            className="sb-button-soft flex-1 px-4 py-2 text-center text-xs"
          >
            View Brochure
          </SafeExternalLink>
          <SmartExternalLink
            url={callForPaper.applyLink}
            className="sb-button-primary flex-1 px-4 py-2 text-center text-xs"
            urlLabel="Register Now"
            emailLabel="Email to Register"
          />
        </div>
      }
    >
      <CollapsibleMediaBody
        href={`/call-for-papers/${callForPaper.id}`}
        imageUrl={callForPaper.imageUrl}
        contentKey={`${callForPaper.description}|${callForPaper.imageUrl ?? ""}`}
        header={
          <>
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
                {getCallForPaperCategoryLabel(callForPaper.category)}
              </span>
            </div>

            <h2 className="mb-2 break-words [overflow-wrap:anywhere] text-lg font-semibold leading-tight text-slate-950 transition-colors group-hover:text-blue-700 dark:text-slate-50 dark:group-hover:text-blue-300">
              {callForPaper.title}
            </h2>
            {(callForPaper.publisher || callForPaper.journal) && (
              <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
                {callForPaper.journal?.title ?? callForPaper.publisher}
                {callForPaper.journal?.title && callForPaper.publisher ? ` · ${callForPaper.publisher}` : ""}
              </p>
            )}

            <div className="mb-3 space-y-1.5">
              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <Calendar className="h-4 w-4 shrink-0 text-slate-400" />
                <span className="font-medium">
                  {callForPaper.eventDate ? formatDate(callForPaper.eventDate) : "Date not specified"}
                </span>
              </div>
              {callForPaper.location && (
                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <MapPin className="h-4 w-4 shrink-0 text-slate-400" />
                  <span className="break-words [overflow-wrap:anywhere]">{callForPaper.location}</span>
                </div>
              )}
              {callForPaper.deadline && (
                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <Clock className="h-4 w-4 shrink-0 text-slate-400" />
                  <span>
                    Deadline:{" "}
                    <span className="font-medium">
                      {formatDate(callForPaper.deadline)}
                    </span>
                  </span>
                </div>
              )}
            </div>
          </>
        }
        text={
          <RichContent
            content={callForPaper.description}
            className="text-sm leading-relaxed text-slate-600 dark:text-slate-300"
          />
        }
      />
    </ListPageCardShell>
  );
}
