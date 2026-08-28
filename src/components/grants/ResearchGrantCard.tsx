"use client";

import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import ListPageCardShell from "@/components/cards/ListPageCardShell";
import { ReportMenu } from "@/components/cards/ReportMenu";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";
import { VoteButton } from "@/components/interactions/VoteButton";
import { RichContent } from "@/components/content/RichContent";
import { deleteResearchGrant } from "@/app/actions/grants";
import { useToast } from "@/components/ui/Toast";
import type { ResearchGrantWithAuthor } from "@/types/cards";

export function ResearchGrantCard({
  grant,
  currentUserId,
}: {
  grant: ResearchGrantWithAuthor;
  currentUserId?: string;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isOwner = currentUserId === grant.authorId;
  const isFollowing = (grant.author?.followers?.length ?? 0) > 0;
  const userVote =
    ((grant.votes || []) as { userId: string; voteType: "UPVOTE" | "DOWNVOTE" }[]).find((v) => v.userId === currentUserId)?.voteType ?? null;

  const deleteMutation = useMutation({
    mutationFn: deleteResearchGrant,
    onSuccess: (response) => {
      if (!response.success || !response.data) {
        toast("Failed to delete grant.", "error");
        return;
      }
      queryClient.setQueriesData(
        { queryKey: ["grants"] },
        (oldData: ResearchGrantWithAuthor[] = []) =>
          oldData.filter((g) => g.id !== response.data.deletedId),
      );
      toast("Grant deleted successfully.", "success");
    },
    onError: (error) => toast(error.message, "error"),
  });

  return (
    <ListPageCardShell
      authorHref={`/scholars/${grant.author?.id}`}
      authorName={grant.author?.name || "Scholar"}
      authorId={grant.author?.id}
      isFollowing={isFollowing}
      currentUserId={currentUserId}
      authorHandle={grant.author?.handle || undefined}
      authorAvatarUrl={grant.author?.avatarUrl || undefined}
      detailPageHref={`/grants/${grant.id}`}
      managementControls={
        isOwner && (
          <OwnerActionsDropdown
            editHref={`/grants/${grant.id}/edit`}
            onDelete={() => {
              deleteMutation.mutate(grant.id);
              return { refresh: false };
            }}
            isOwner={true}
            editLabel="Edit Grant"
            deleteLabel="Delete"
          />
        )
      }
      createdDate={grant.createdAt}
      editedDate={
        grant.editedAt && grant.editedAt > grant.createdAt ? grant.editedAt : undefined
      }
      footerVoteButton={
        <VoteButton
          targetId={grant.id}
          module="RESEARCH_GRANT"
          initialTotalVotes={grant.totalVotes ?? 0}
          initialUserVote={userVote}
        />
      }
      footerCommentsHref={`/grants/${grant.id}`}
      footerCommentsCount={grant.totalComments}
      footerReportMenu={
        <ReportMenu entityId={grant.id} entityType="POST" module="RESEARCH_GRANT" />
      }
      noBodyLink={true}
      bodyBottomContent={
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          {grant.applyLink && (
            <a
              href={grant.applyLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 rounded-lg bg-slate-950 py-2 text-center text-xs font-semibold text-white transition-colors hover:bg-slate-800"
            >
              Apply
            </a>
          )}
          {grant.infoLink && (
            <a
              href={grant.infoLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 rounded-lg border border-slate-200 py-2 text-center text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-900"
            >
              More Info
            </a>
          )}
        </div>
      }
    >
      <Link href={`/grants/${grant.id}`} className="block group">
        <h2 className="mb-2 text-lg font-semibold leading-tight text-slate-950 transition-colors group-hover:text-blue-700 dark:text-slate-50 dark:group-hover:text-blue-300">
          {grant.title}
        </h2>
        {grant.amount && (
          <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
            <span className="font-semibold text-slate-800 dark:text-slate-100">
              Amount:
            </span>{" "}
            {grant.amount}
          </p>
        )}
        <RichContent
          content={grant.description}
          className="text-sm leading-relaxed text-slate-600 line-clamp-3"
        />
      </Link>
    </ListPageCardShell>
  );
}
