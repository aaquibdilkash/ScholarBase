"use client";
import { useQueryClient } from "@tanstack/react-query";
import { VoteButton } from "@/components/interactions/VoteButton";
import ListPageCardShell from "@/components/cards/ListPageCardShell";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";
import { ReportMenu } from "@/components/cards/ReportMenu";
import { deleteSupervisor } from "@/app/actions/supervisors";
import { useToast } from "@/components/ui/Toast";
import { StarRating } from "@/components/ui/StarRating";
import type { SupervisorWithAuthor } from "@/types/cards";

export function SupervisorCard({
  supervisor,
  currentUserId,
}: {
  supervisor: SupervisorWithAuthor;
  currentUserId?: string;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isOwner = currentUserId === supervisor.authorId;
  const recommendationCount = supervisor.recommendationCount ?? 0;

  const avgRating =
    recommendationCount > 0 ? (supervisor.ratingSum ?? 0) / recommendationCount : 0;

  const userVote: "UPVOTE" | "DOWNVOTE" | null =
    (supervisor.votes || []).find((v: { userId?: string; voteType?: string }) => v.userId === currentUserId)?.voteType ?? null;
  const isFollowing = (supervisor.author?.followers?.length ?? 0) > 0;

  return (
    <ListPageCardShell
      authorHref={`/scholars/${supervisor.author?.id}`}
      authorName={supervisor.author?.name || "Supervisor"}
      authorId={supervisor.authorId}
      isFollowing={isFollowing}
      currentUserId={currentUserId}
      authorHandle={supervisor.author?.handle || undefined}
      authorAvatarUrl={supervisor.author?.avatarUrl || undefined}
      detailPageHref={`/supervisor/${supervisor.id}`}
      managementControls={
        isOwner && (
          <OwnerActionsDropdown
            editHref={`/supervisor/${supervisor.id}/edit`}
            isOwner={true}
            editLabel="Edit Supervisor"
            deleteLabel="Delete"
            onDelete={async () => {
              try {
                const response = await deleteSupervisor(supervisor.id);
                if (!response?.success || !response.data) {
                  toast("Failed to delete supervisor.", "error");
                  return { refresh: false };
                }
                queryClient.setQueriesData(
                  { queryKey: ["supervisors"] },
                  (oldData: SupervisorWithAuthor[] = []) =>
                    oldData.filter((s) => s.id !== response.data.deletedId),
                );
                toast("Supervisor deleted successfully.", "success");
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
      createdDate={supervisor.createdAt}
      editedDate={
        supervisor.editedAt && supervisor.editedAt > supervisor.createdAt ? supervisor.editedAt : undefined
      }
      footerVoteButton={
        <VoteButton
          frozen={supervisor.isFrozen === true}
          targetId={supervisor.id}
          module="SUPERVISOR"
          initialTotalVotes={supervisor.totalVotes}
          initialUserVote={userVote}
        />
      }
      footerCommentsHref={`/supervisor/${supervisor.id}#comments`}
      footerCommentsCount={supervisor.totalComments}
      footerReportMenu={
        <ReportMenu
          entityId={supervisor.id}
          entityType="POST"
          module="SUPERVISOR"
          ownerId={supervisor.author?.id ?? supervisor.authorId ?? null}
          currentUserId={currentUserId ?? null}
          isFrozen={supervisor.isFrozen ?? false}
          hasActiveAppeal={supervisor.hasActiveAppeal ?? false}
        />
      }
    >
      <h3 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight mb-2">
        {supervisor.name}
      </h3>
      <p className="mb-2 text-sm font-medium text-slate-600">
        {supervisor.university}
      </p>
      {supervisor.department && (
        <p className="mb-4 text-sm text-slate-500">{supervisor.department}</p>
      )}

      {recommendationCount > 0 ? (
        <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3">
          <StarRating rating={avgRating} size="sm" />
          <div className="text-sm">
            <span className="font-semibold">{avgRating.toFixed(1)}</span>
            <span className="text-slate-500"> / 5</span>
          </div>
          <span className="text-slate-500 text-xs">
            ({recommendationCount} recommendation
            {recommendationCount !== 1 ? "s" : ""})
          </span>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 text-center text-sm text-slate-500">
          No recommendations yet.
        </div>
      )}
    </ListPageCardShell>
  );
}
