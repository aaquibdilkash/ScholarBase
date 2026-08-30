"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { VoteButton } from "@/components/interactions/VoteButton";
import ListPageCardShell from "@/components/cards/ListPageCardShell";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";
import { ReportMenu } from "@/components/cards/ReportMenu";
import { deleteRecommendation } from "@/app/actions/recommendations";
import { useToast } from "@/components/ui/Toast";
import { RichContent } from "@/components/content/RichContent";
import { decrementRecommendation } from "./recommendationCount";
import { StarRating } from "@/components/ui/StarRating";
import type { RecommendationWithAuthor } from "@/types/cards";

export function RecommendationCard({
  recommendation,
  supervisor,
  currentUserId,
}: {
  recommendation: RecommendationWithAuthor;
  supervisor: { id: string; name: string | null };
  currentUserId?: string;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const router = useRouter();

  const openSupervisorPage = () => router.push(`/supervisor/${supervisor.id}`);
  const openRecommendationPage = () =>
    router.push(
      `/supervisor/${supervisor.id}/recommendation/${recommendation.id}`,
    );

  const userVote: "UPVOTE" | "DOWNVOTE" | null =
    (recommendation.votes || []).find(
      (v: { userId?: string; voteType?: string }) => v.userId === currentUserId,
    )?.voteType ?? null;

  const ownerId = recommendation.authorId ?? recommendation.author?.id;
  const isOwner = !!currentUserId && ownerId === currentUserId;
  const isFollowing = (recommendation.author?.followers?.length ?? 0) > 0;

  const deleteMutation = useMutation({
    mutationFn: deleteRecommendation,
  });

  const handleDeleteFromDropdown = async () => {
    try {
      const response = await deleteMutation.mutateAsync(recommendation.id);
      if (!response?.success || !response.data) {
        toast("Failed to delete recommendation.", "error");
        return { refresh: false };
      }

      // 1. Remove from the array cache instantly & refill
      queryClient.setQueriesData(
        { queryKey: ["recommendations", supervisor.id] },
        (oldData: RecommendationWithAuthor[] = []) =>
          oldData.filter((r) => r.id !== response.data.deletedId),
      );
      queryClient.invalidateQueries({
        queryKey: ["recommendations", supervisor.id],
      });

      // 2. Keep the reactive count in sync
      decrementRecommendation(
        queryClient,
        supervisor.id,
        recommendation.rating,
      );

      // 🟢 3. CRITICAL: Tell the RecommendButton in the header to change its state!
      queryClient.setQueryData(["user_rec_status", supervisor.id], null);

      toast("Recommendation deleted successfully.", "success");
      return { refresh: false };
    } catch (error) {
      toast((error as Error).message, "error");
      return { refresh: false };
    }
  };

  return (
    <ListPageCardShell
      authorHref={
        recommendation.isAnonymous
          ? undefined
          : `/scholars/${recommendation.author?.id}`
      }
      authorName={
        recommendation.isAnonymous
          ? "Anonymous Scholar"
          : recommendation.author?.name || "Scholar"
      }
      authorId={
        recommendation.isAnonymous ? undefined : recommendation.author?.id
      }
      isFollowing={recommendation.isAnonymous ? false : isFollowing}
      currentUserId={currentUserId}
      authorHandle={
        recommendation.isAnonymous
          ? undefined
          : recommendation.author?.handle || undefined
      }
      authorAvatarUrl={
        recommendation.isAnonymous
          ? null
          : recommendation.author?.avatarUrl || undefined
      }
      detailPageHref={`/supervisor/${supervisor.id}/recommendation/${recommendation.id}`}
      noBodyLink
      managementControls={
        isOwner && (
          <OwnerActionsDropdown
            editHref={`/supervisor/${supervisor.id}/recommendation/${recommendation.id}/edit`}
            onDelete={handleDeleteFromDropdown}
            isOwner={isOwner}
            editLabel="Edit Recommendation"
            deleteLabel="Delete Recommendation"
          />
        )
      }
      createdDate={recommendation.createdAt}
      footerVoteButton={
        <VoteButton
          frozen={recommendation.isFrozen === true}
          targetId={recommendation.id}
          module="RECOMMENDATION"
          initialTotalVotes={recommendation.totalVotes ?? 0}
          initialUserVote={userVote}
        />
      }
      footerCommentsHref={`/supervisor/${supervisor.id}/recommendation/${recommendation.id}`}
      footerCommentsCount={recommendation.totalComments}
      footerReportMenu={
        <ReportMenu
          entityId={recommendation.id}
          entityType="POST"
          module="RECOMMENDATION"
        />
      }
    >
      <div
        role="link"
        tabIndex={0}
        onClick={() => openRecommendationPage()}
        onKeyDown={(e) => {
          if (e.key === "Enter") openRecommendationPage();
        }}
        className="cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg"
      >
        <p className="text-sm font-semibold text-slate-700 mb-2">
          {recommendation.isAnonymous
            ? "Anonymous recommendation for "
            : "Recommendation for "}
          <span
            role="link"
            tabIndex={0}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              openSupervisorPage();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                openSupervisorPage();
              }
            }}
            className="cursor-pointer text-blue-700 transition hover:text-blue-800 hover:underline dark:text-blue-300 dark:hover:text-blue-200"
          >
            {supervisor.name}
          </span>
        </p>
        <div className="space-y-3 mb-4">
          <div>
            <p className="text-xs font-semibold text-slate-700 mb-1">
              Overall Mentorship Rating
            </p>
            <StarRating rating={recommendation.rating} size="md" />
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="col-span-2 sm:col-span-1">
              <p className="text-xs font-semibold text-slate-600 mb-1">
                Responsiveness
              </p>
              <StarRating
                rating={recommendation.responsivenessScore}
                size="sm"
              />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-600 mb-1">
                Guidance
              </p>
              <StarRating rating={recommendation.guidanceScore} size="sm" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-600 mb-1">
                Turnaround
              </p>
              <p className="text-sm font-bold text-slate-800">
                {recommendation.turnaroundTimeDays}d
              </p>
            </div>
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold text-slate-700 mb-2">
            Mentorship Feedback
          </p>
          <RichContent
            content={recommendation.feedback}
            className="text-sm leading-relaxed text-slate-600 line-clamp-4"
          />
        </div>
      </div>
    </ListPageCardShell>
  );
}
