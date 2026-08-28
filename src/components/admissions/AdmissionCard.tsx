"use client";

import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";
import ListPageCardShell from "@/components/cards/ListPageCardShell";
import { ReportMenu } from "@/components/cards/ReportMenu";
import { VoteButton } from "@/components/interactions/VoteButton";
import { deletePhdAdmission } from "@/app/actions/admissions";
import { RichContent } from "@/components/content/RichContent";
import Link from "next/link";
import { getTimeLeft } from "@/utils/time-ago";
import { Clock } from "lucide-react";
import type { AdmissionWithAuthor } from "@/types/cards";
import { useQueryClient } from "@tanstack/react-query";

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function AdmissionCard({
  admission,
  currentUserId,
}: {
  admission: AdmissionWithAuthor;
  currentUserId?: string;
}) {
  const queryClient = useQueryClient();
  const isOwner = currentUserId === admission.authorId;
  const isFollowing = (admission.author?.followers?.length ?? 0) > 0;
  const userVote: "UPVOTE" | "DOWNVOTE" | null =
    (admission.votes || [])[0]?.voteType ?? null;
  const urgency = getTimeLeft(admission.deadline);

  return (
    <ListPageCardShell
      authorHref={`/scholars/${admission.author?.id}`}
      authorName={admission.author?.name || "Scholar"}
      authorId={admission.author?.id}
      isFollowing={isFollowing}
      currentUserId={currentUserId}
      authorHandle={admission.author?.handle || undefined}
      authorAvatarUrl={admission.author?.avatarUrl || undefined}
      detailPageHref={`/admissions/${admission.id}`}
      managementControls={
        isOwner && (
          <OwnerActionsDropdown
            editHref={`/admissions/${admission.id}/edit`}
            isOwner={true}
            onDelete={async () => {
              const res = await deletePhdAdmission(admission.id);
              if (res?.success) {
                queryClient.setQueryData(
                  ["admissions", ""],
                  (oldData: AdmissionWithAuthor[] | undefined) => {
                    return oldData?.filter((post) => post.id !== admission.id);
                  },
                );
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
          targetId={admission.id}
          module="PHD_ADMISSION"
          initialTotalVotes={admission.totalVotes ?? 0}
          initialUserVote={userVote}
        />
      }
      footerCommentsHref={`/admissions/${admission.id}`}
      footerCommentsCount={admission.totalComments}
      footerReportMenu={
        <ReportMenu entityId={admission.id} entityType="POST" module="PHD_ADMISSION" />
      }
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
              <Clock className="h-3 w-3" />
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
            <Clock className="h-4 w-4 shrink-0 text-slate-400" />
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
