"use client";

import { useQueryClient } from "@tanstack/react-query";
import ListPageCardShell from "@/components/cards/ListPageCardShell";
import { ReportMenu } from "@/components/cards/ReportMenu";
import { VoteButton } from "@/components/interactions/VoteButton";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";
import { deleteContribution } from "@/app/actions/contributions";
import { useToast } from "@/components/ui/Toast";
import { RichContent } from "@/components/content/RichContent";
import type { ContributionWithAuthor } from "@/types/cards";

export function ContributionCard({
  contribution,
  currentUserId,
}: {
  contribution: ContributionWithAuthor;
  currentUserId?: string;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isOwner = currentUserId === contribution.authorId;
  const isFollowing = (contribution.author?.followers?.length ?? 0) > 0;
  const userVote: "UPVOTE" | "DOWNVOTE" | null =
    (contribution.votes || [])[0]?.voteType ??
    null;

  return (
    <ListPageCardShell
      authorHref={`/scholars/${contribution.author?.id}`}
      authorName={contribution.author?.name || "Scholar"}
      authorId={contribution.authorId}
      isFollowing={isFollowing}
      currentUserId={currentUserId}
      authorHandle={contribution.author?.handle || undefined}
      authorAvatarUrl={contribution.author?.avatarUrl || undefined}
      detailPageHref={`/contributions/${contribution.id}`}
      managementControls={
        isOwner && (
          <OwnerActionsDropdown
            editHref={`/contributions/${contribution.id}/edit`}
            isOwner={true}
            editLabel="Edit Contribution"
            deleteLabel="Delete"
            onDelete={async () => {
              try {
                const response = await deleteContribution(contribution.id);
                if (!response?.success || !response.data) {
                  toast("Failed to delete contribution.", "error");
                  return { refresh: false };
                }
                queryClient.setQueriesData(
                  { queryKey: ["contributions"] },
                  (oldData: ContributionWithAuthor[] = []) =>
                    oldData.filter((c) => c.id !== response.data.deletedId),
                );
                toast("Contribution deleted successfully.", "success");
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
      createdDate={contribution.createdAt}
      editedDate={
        contribution.editedAt && contribution.editedAt > contribution.createdAt
          ? contribution.editedAt
          : undefined
      }
      footerVoteButton={
        <VoteButton
          frozen={contribution.isFrozen === true}
          targetId={contribution.id}
          module="CONTRIBUTION"
          initialTotalVotes={contribution.totalVotes ?? 0}
          initialUserVote={userVote}
        />
      }
      footerCommentsHref={`/contributions/${contribution.id}`}
      footerCommentsCount={contribution.totalComments}
      footerReportMenu={
        <ReportMenu
          entityId={contribution.id}
          entityType="POST"
          module="CONTRIBUTION"
          ownerId={contribution.author?.id ?? contribution.authorId ?? null}
          currentUserId={currentUserId ?? null}
          isFrozen={contribution.isFrozen ?? false}
          hasActiveAppeal={contribution.hasActiveAppeal ?? false}
        />
      }
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            contribution.status === "APPROVED"
              ? "bg-green-100 text-green-700"
              : contribution.status === "PENDING"
                ? "bg-amber-100 text-amber-700"
                : "bg-red-100 text-red-700"
          }`}
        >
          {contribution.status}
        </span>
        {contribution.amount && (
          <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
            ₹{contribution.amount}
          </span>
        )}
      </div>

      <h2 className="mb-2 text-lg font-semibold leading-tight text-slate-950 group-hover:text-blue-700 transition-colors">
        {contribution.title}
      </h2>

      <RichContent
        content={contribution.message}
        className="text-sm leading-relaxed text-slate-600 line-clamp-3"
      />
    </ListPageCardShell>
  );
}
