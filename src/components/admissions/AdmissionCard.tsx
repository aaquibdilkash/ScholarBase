"use client";

import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";
import ListPageCardShell from "@/components/cards/ListPageCardShell";
import { ReportMenu } from "@/components/cards/ReportMenu";
import { VoteButton } from "@/components/interactions/VoteButton";
import { BookmarkButton } from "@/components/interactions/BookmarkButton";
import { deleteAdmission } from "@/app/actions/admissions";
import { RichContent } from "@/components/content/RichContent";
import { CollapsibleMediaBody } from "@/components/cards/CollapsibleMediaBody";
import { getTimeLeft } from "@/utils/time-ago";
import { formatDate } from "@/utils/date";
import { Clock } from "lucide-react";
import type { AdmissionWithAuthor } from "@/types/cards";
import { removeFromList } from "@/utils/cacheMutation";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/Toast";
import { SafeExternalLink } from "@/components/ui/SafeExternalLink";
import { SmartExternalLink } from "@/components/ui/SmartExternalLink";
import { getAdmissionLevelLabel } from "@/lib/admissions";

export function AdmissionCard({
  admission,
  currentUserId,
}: {
  admission: AdmissionWithAuthor;
  currentUserId?: string;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isOwner = currentUserId === admission.authorId;
  const isFollowing = (admission.author?.followers?.length ?? 0) > 0;
  const userVote: "UPVOTE" | "DOWNVOTE" | null =
    (admission.votes || [])[0]?.voteType ?? null;
  const urgency = getTimeLeft(admission.deadline);
  // Share payload: mirror admissions/[id]/page.tsx generateMetadata().
  const levelLabel = getAdmissionLevelLabel(admission.level);
  const shareTitle = `${admission.university} - ${admission.department} ${levelLabel} Admission`;
  const shareText = `Apply for ${levelLabel} admission at ${admission.university} (${admission.department}). Deadline: ${new Date(
    admission.deadline,
  ).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })}.`;

  return (
    <ListPageCardShell
      authorHref={`/scholars/${admission.author?.id}`}
      authorName={admission.author?.name || "Scholar"}
      authorId={admission.author?.id}
      isFollowing={isFollowing}
      currentUserId={currentUserId}
      authorHandle={admission.author?.handle || undefined}
      authorAvatarUrl={admission.author?.avatarUrl || undefined} authorVerified={!!(admission.author?.institutionVerifiedAt)}
      isFrozen={admission.isFrozen ?? false}
      frozenEntityId={admission.id}
      frozenModule="ADMISSION"
      frozenEntityType="POST"
      frozenOwnerId={admission.author?.id ?? null}
      frozenHasActiveAppeal={admission.hasActiveAppeal ?? false}
      detailPageHref={`/admissions/${admission.id}`}
      shareTitle={shareTitle}
      shareText={shareText}
      managementControls={
        isOwner && (
          <OwnerActionsDropdown
            editHref={`/admissions/${admission.id}/edit`}
            isOwner={true}
            onDelete={async () => {
              const res = await deleteAdmission(admission.id);
              if (res?.success) {
                removeFromList<AdmissionWithAuthor>(
                  queryClient,
                  ["admissions"],
                  res.data.deletedId,
                );
                toast("Admission deleted successfully.", "success");
              }
              return { refresh: false };
            }}
            editLabel="Edit Admission"
            deleteLabel="Delete"
          />
        )
      }
      createdDate={admission.createdAt}
      footerVoteButton={
        <VoteButton
          frozen={admission.isFrozen === true}
          targetId={admission.id}
          module="ADMISSION"
          initialTotalVotes={admission.totalVotes ?? 0}
          initialUserVote={userVote}
          isOwnContent={isOwner}
        />
      }
      footerBookmarkButton={
        <BookmarkButton
          frozen={admission.isFrozen === true}
          targetId={admission.id}
          module="ADMISSION"
          initialTotalBookmarks={admission.totalBookmarks ?? 0}
          initialIsBookmarked={Array.isArray(admission.bookmarks) && admission.bookmarks.length > 0}
        />
      }
      footerCommentsHref={`/admissions/${admission.id}`}
      footerCommentsCount={admission.totalComments}
      footerReportMenu={
        <ReportMenu
          entityId={admission.id}
          entityType="POST"
          module="ADMISSION"
          ownerId={admission.author?.id ?? admission.authorId ?? null}
          currentUserId={currentUserId ?? null}
          isFrozen={admission.isFrozen ?? false}
          hasActiveAppeal={admission.hasActiveAppeal ?? false}
        />
      }
      noBodyLink={true}
      constrainBody={false}
      bodyBottomContent={
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <SafeExternalLink
            url={admission.notificationLink}
            className="sb-button-soft flex-1 px-4 py-2 text-center text-xs"
          >
            View Circular
          </SafeExternalLink>
          <SmartExternalLink
            url={admission.applyLink}
            className="sb-button-primary flex-1 px-4 py-2 text-center text-xs"
            urlLabel="Go to Portal"
            emailLabel="Email to Apply"
          />
        </div>
      }
    >
      <CollapsibleMediaBody
        href={`/admissions/${admission.id}`}
        imageUrl={admission.imageUrl}
        contentKey={`${admission.description}|${admission.imageUrl ?? ""}`}
        header={
          <>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                {levelLabel}
              </span>
              {urgency && (
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${urgency.className}`}
                >
                  <Clock className="h-3 w-3" />
                  {urgency.label}
                </span>
              )}
            </div>

            <h2 className="mb-2 break-words [overflow-wrap:anywhere] text-lg font-semibold leading-tight text-slate-950 transition-colors group-hover:text-blue-700 dark:text-slate-50 dark:group-hover:text-blue-300">
              {admission.university}
            </h2>

            <div className="mb-3 space-y-1.5">
              <p className="break-words text-sm font-semibold text-slate-950 [overflow-wrap:anywhere] dark:text-slate-50">
                {admission.department}
              </p>
              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <Clock className="h-4 w-4 shrink-0 text-slate-400" />
                <span>
                  Deadline:{" "}
                  <span className="font-medium">
                    {formatDate(admission.deadline)}
                  </span>
                </span>
              </div>
            </div>
          </>
        }
        text={
          <RichContent
            content={admission.description}
            className="text-sm leading-relaxed text-slate-600 dark:text-slate-300"
          />
        }
      />
    </ListPageCardShell>
  );
}
