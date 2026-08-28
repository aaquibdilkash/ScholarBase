"use client";

import { Clock } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import ListPageCardShell from "@/components/cards/ListPageCardShell";
import { ReportMenu } from "@/components/cards/ReportMenu";
import { VoteButton } from "@/components/interactions/VoteButton";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";
import { RichContent } from "@/components/content/RichContent";
import Link from "next/link";
import { deleteJobVacancy } from "@/app/actions/vacancies";
import { useToast } from "@/components/ui/Toast";
import { getTimeLeft } from "@/utils/time-ago";
import type { VacancyWithAuthor } from "@/types/cards";

export function VacancyCard({
  vacancy,
  currentUserId,
}: {
  vacancy: VacancyWithAuthor;
  currentUserId?: string;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isOwner = currentUserId === vacancy.authorId;
  const isFollowing = (vacancy.author?.followers?.length ?? 0) > 0;
  const userVote: "UPVOTE" | "DOWNVOTE" | null =
    ((vacancy.votes || []) as { userId: string; voteType: "UPVOTE" | "DOWNVOTE" }[]).find((v) => v.userId === currentUserId)?.voteType ?? null;
  const urgency = getTimeLeft(vacancy.deadline);

  const deleteMutation = useMutation({
    mutationFn: deleteJobVacancy,
    onSuccess: (response) => {
      if (!response || !response.success || !response.data) {
        toast("Failed to delete vacancy.", "error");
        return;
      }
      queryClient.setQueriesData(
        { queryKey: ["vacancies"] },
        (oldData: VacancyWithAuthor[] = []) =>
          oldData.filter((v) => v.id !== response.data.deletedId),
      );
      toast("Vacancy deleted successfully.", "success");
    },
    onError: (error) => toast(error.message, "error"),
  });

  return (
    <ListPageCardShell
      authorHref={`/scholars/${vacancy.author?.id}`}
      authorName={vacancy.author?.name || "Scholar"}
      authorId={vacancy.author?.id}
      isFollowing={isFollowing}
      currentUserId={currentUserId}
      authorHandle={vacancy.author?.handle || undefined}
      authorAvatarUrl={vacancy.author?.avatarUrl || undefined}
      detailPageHref={`/vacancies/${vacancy.id}`}
      managementControls={
        isOwner && (
          <OwnerActionsDropdown
            editHref={`/vacancies/${vacancy.id}/edit`}
            isOwner={true}
            editLabel="Edit Vacancy"
            deleteLabel="Delete"
            onDelete={() => {
              deleteMutation.mutate(vacancy.id);
              return { refresh: false };
            }}
          />
        )
      }
      createdDate={vacancy.createdAt}
      footerVoteButton={
        <VoteButton
          targetId={vacancy.id}
          module="JOB_VACANCY"
          initialTotalVotes={vacancy.totalVotes ?? 0}
          initialUserVote={userVote}
        />
      }
      footerCommentsHref={`/vacancies/${vacancy.id}`}
      footerCommentsCount={vacancy.totalComments}
      footerReportMenu={
        <ReportMenu entityId={vacancy.id} entityType="POST" module="JOB_VACANCY" />
      }
      noBodyLink={true}
      bodyBottomContent={
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          {vacancy.notificationLink && (
            <a
              href={vacancy.notificationLink}
              target="_blank"
              rel="noopener noreferrer"
              className="sb-button-soft flex-1 px-4 py-2 text-center text-xs"
            >
              Details
            </a>
          )}

          {vacancy.applyLink && (
            <a
              href={vacancy.applyLink}
              target="_blank"
              rel="noopener noreferrer"
              className="sb-button-primary flex-1 px-4 py-2 text-center text-xs"
            >
              Apply
            </a>
          )}
        </div>
      }
    >
      <Link href={`/vacancies/${vacancy.id}`} className="block group">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {urgency && (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${urgency.className}`}
            >
              <Clock className="h-3 w-3" strokeWidth="2.5" />
              {urgency.label}
            </span>
          )}
        </div>
        <h2 className="mb-2 text-lg font-semibold leading-tight text-slate-950 group-hover:text-blue-700 transition-colors">
          {vacancy.title}
        </h2>
        <p className="mb-2 text-sm font-medium text-slate-600">
          {vacancy.institution}
        </p>

        <div className="mb-2 flex items-center gap-2 text-sm text-slate-600">
          <Clock className="h-4 w-4 shrink-0 text-slate-400" strokeWidth="2" />
          <span>
            Last Date:{" "}
            <span className="font-medium">
              {new Date(vacancy.deadline).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </span>
        </div>

        <RichContent
          content={vacancy.description}
          className="text-sm leading-relaxed text-slate-600 line-clamp-3"
        />
      </Link>
    </ListPageCardShell>
  );
}
