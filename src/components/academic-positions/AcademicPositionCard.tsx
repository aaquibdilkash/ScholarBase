"use client";

import { Clock, BookOpen, MapPin, Banknote, CalendarClock } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { removeFromList } from "@/utils/cacheMutation";
import ListPageCardShell from "@/components/cards/ListPageCardShell";
import { ReportMenu } from "@/components/cards/ReportMenu";
import { VoteButton } from "@/components/interactions/VoteButton";
import { BookmarkButton } from "@/components/interactions/BookmarkButton";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";
import { RichContent } from "@/components/content/RichContent";
import Link from "next/link";
import { SmartExternalLink } from "@/components/ui/SmartExternalLink";
import { deleteAcademicPosition } from "@/app/actions/academic-positions";
import { useToast } from "@/components/ui/Toast";
import { actionErrorMessage } from "@/lib/utils";
import { getTimeLeft } from "@/utils/time-ago";
import { formatDate } from "@/utils/date";
import type { AcademicPositionWithAuthor } from "@/types/cards";
import { getPositionTypeLabel, getEmploymentTypeLabel } from "@/lib/academic-positions";

export function AcademicPositionCard({ academicPosition,
  currentUserId,
}: {
  academicPosition: AcademicPositionWithAuthor;
  currentUserId?: string;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isOwner = currentUserId === academicPosition.authorId;
  const isFollowing = (academicPosition.author?.followers?.length ?? 0) > 0;
  const userVote: "UPVOTE" | "DOWNVOTE" | null =
    (academicPosition.votes || [])[0]?.voteType ?? null;
  const urgency = getTimeLeft(academicPosition.deadline);
  const positionTypeLabel = getPositionTypeLabel(academicPosition.positionType);
  const employmentTypeLabel = getEmploymentTypeLabel(academicPosition.employmentType);
  // Compact affiliation line: "Dept. of Physics • Quantum Optics". Renders
  // whichever parts exist; hidden when both are null (pre-migration rows).
  const deptSubject = [academicPosition.department, academicPosition.subject]
    .map((part) => part?.trim())
    .filter((part): part is string => !!part)
    .join(" • ");
  // Share payload: mirror academicPositions/[id]/page.tsx generateMetadata().
  const shareAffiliation = [academicPosition.department, academicPosition.subject]
    .map((part) => part?.trim())
    .filter((part): part is string => !!part)
    .join(" • ");
  const shareTitle = `${academicPosition.title} at ${academicPosition.institution}`;
  const shareText = shareAffiliation
    ? `${academicPosition.title} at ${academicPosition.institution} (${shareAffiliation}). Last date to apply: ${
    new Date(academicPosition.deadline).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }.`
    : `${academicPosition.title} at ${academicPosition.institution}. Last date to apply: ${
    new Date(academicPosition.deadline).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }.`;

  return (
    <ListPageCardShell
      authorHref={`/scholars/${academicPosition.author?.id}`}
      authorName={academicPosition.author?.name || "Scholar"}
      authorId={academicPosition.authorId}
      isFollowing={isFollowing}
      currentUserId={currentUserId}
      authorHandle={academicPosition.author?.handle || undefined}
      authorAvatarUrl={academicPosition.author?.avatarUrl || undefined} authorVerified={!!(academicPosition.author?.institutionVerifiedAt)}
      isFrozen={academicPosition.isFrozen ?? false}
      frozenEntityId={academicPosition.id}
      frozenModule="ACADEMIC_POSITION"
      frozenEntityType="POST"
      frozenOwnerId={academicPosition.author?.id ?? null}
      frozenHasActiveAppeal={academicPosition.hasActiveAppeal ?? false}
      detailPageHref={`/academic-positions/${academicPosition.id}`}
      shareTitle={shareTitle}
      shareText={shareText}
      managementControls={
        isOwner && (
          <OwnerActionsDropdown
            editHref={`/academic-positions/${academicPosition.id}/edit`}
            isOwner={true}
            editLabel="Edit Academic Position"
            deleteLabel="Delete"
            onDelete={async () => {
              try {
                const response = await deleteAcademicPosition(academicPosition.id);
                if (!response?.success || !response.data) {
                  toast(actionErrorMessage(response, "Failed to delete this position."), "error");
                  return { refresh: false };
                }
                removeFromList<AcademicPositionWithAuthor>(queryClient, ["academicPositions"], response.data.deletedId);
                toast("Position deleted successfully.", "success");
                return { refresh: false };
              } catch (error) {
                const message = error instanceof Error ? error.message : "Unknown error";
                toast(message, "error");
                return { refresh: false };
              }
            }}
          />
        )
      }
      createdDate={academicPosition.createdAt}
      editedDate={
        academicPosition.editedAt && academicPosition.editedAt > academicPosition.createdAt ? academicPosition.editedAt : undefined
      }
      footerVoteButton={
        <VoteButton
          frozen={academicPosition.isFrozen === true}
          targetId={academicPosition.id}
          module="ACADEMIC_POSITION"
          initialTotalVotes={academicPosition.totalVotes ?? 0}
          initialUserVote={userVote}
          isOwnContent={isOwner}
        />
      }
      footerBookmarkButton={
        <BookmarkButton
          frozen={academicPosition.isFrozen === true}
          targetId={academicPosition.id}
          module="ACADEMIC_POSITION"
          initialTotalBookmarks={academicPosition.totalBookmarks ?? 0}
          initialIsBookmarked={Array.isArray(academicPosition.bookmarks) && academicPosition.bookmarks.length > 0}
        />
      }
      footerCommentsHref={`/academic-positions/${academicPosition.id}`}
      footerCommentsCount={academicPosition.totalComments}
      footerReportMenu={
        <ReportMenu
          entityId={academicPosition.id}
          entityType="POST"
          module="ACADEMIC_POSITION"
          ownerId={academicPosition.author?.id ?? academicPosition.authorId ?? null}
          currentUserId={currentUserId ?? null}
          isFrozen={academicPosition.isFrozen ?? false}
          hasActiveAppeal={academicPosition.hasActiveAppeal ?? false}
        />
      }
      noBodyLink={true}
      constrainBody={true}
      bodyBottomContent={
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <SmartExternalLink
                      url={academicPosition.notificationLink}
                      className="flex-1 sb-button-soft"
                      urlLabel="View Details"
                    />
                    <SmartExternalLink
                      url={academicPosition.applyLink}
                      className="flex-1 sb-button-primary"
                      urlLabel="Apply Now"
                      emailLabel="Email to Apply"
                    /> 
        </div>
      }
    >
      <Link href={`/academic-positions/${academicPosition.id}`} prefetch={false} className="block group">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
            {positionTypeLabel}
          </span>
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {employmentTypeLabel}
          </span>
          {urgency && (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${urgency.className}`}
            >
              <Clock className="h-3 w-3" strokeWidth="2.5" />
              {urgency.label}
            </span>
          )}
        </div>
        <h2 className="mb-2 break-words [overflow-wrap:anywhere] text-lg font-semibold leading-tight text-slate-950 transition-colors group-hover:text-blue-700 dark:text-slate-50 dark:group-hover:text-blue-300">
          {academicPosition.title}
        </h2>
        <p className="mb-2 break-words text-sm font-medium text-slate-600 dark:text-slate-300 [overflow-wrap:anywhere]">
          {academicPosition.institution}
        </p>
        {deptSubject && (
          <p className="mb-2 flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
            <BookOpen className="h-4 w-4 shrink-0 text-slate-400" strokeWidth={2} />
            <span className="min-w-0 flex-1 break-words [overflow-wrap:anywhere]">
              {deptSubject}
            </span>
          </p>
        )}

        {(academicPosition.salaryOrStipend ||
          academicPosition.contractDuration ||
          academicPosition.location ||
          academicPosition.isRemote) && (
          <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600 dark:text-slate-300">
            {academicPosition.salaryOrStipend && (
              <span className="inline-flex items-center gap-1.5">
                <Banknote className="h-4 w-4 shrink-0 text-slate-400" strokeWidth={2} />
                {academicPosition.salaryOrStipend}
              </span>
            )}
            {academicPosition.contractDuration && (
              <span className="inline-flex items-center gap-1.5">
                <CalendarClock className="h-4 w-4 shrink-0 text-slate-400" strokeWidth={2} />
                {academicPosition.contractDuration}
              </span>
            )}
            {(academicPosition.location || academicPosition.isRemote) && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-4 w-4 shrink-0 text-slate-400" strokeWidth={2} />
                {academicPosition.isRemote
                  ? academicPosition.location
                    ? `Remote — ${academicPosition.location}`
                    : "Remote"
                  : academicPosition.location}
              </span>
            )}
          </div>
        )}

        <div className="mb-2 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <Clock className="h-4 w-4 shrink-0 text-slate-400" strokeWidth={2} />
          <span>
            Last Date:{" "}
            <span className="font-medium">
              {formatDate(academicPosition.deadline)}
            </span>
          </span>
        </div>

        <RichContent
          content={academicPosition.description}
          className="text-sm leading-relaxed text-slate-600 dark:text-slate-300"
        />
      </Link>
    </ListPageCardShell>
  );
}
