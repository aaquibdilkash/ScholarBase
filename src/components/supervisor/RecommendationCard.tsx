"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { VoteButton } from "@/components/interactions/VoteButton";
import ListPageCardShell from "@/components/cards/ListPageCardShell";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";
import { deleteRecommendation } from "@/app/actions/recommendations";
import { useToast } from "@/components/ui/Toast";
import { RichContent } from "@/components/content/RichContent";
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
  const userVote: "UPVOTE" | "DOWNVOTE" | null =
    recommendation.votes?.find((v) => v.userId === currentUserId)?.voteType ??
    null;
  const upvoteCount =
    recommendation.votes?.filter((v) => v.voteType === "UPVOTE").length ?? 0;
  const downvoteCount =
    recommendation.votes?.filter((v) => v.voteType === "DOWNVOTE").length ?? 0;

  const isOwner = currentUserId === recommendation.author.id;
  const isFollowing = (recommendation.author.followers?.length ?? 0) > 0;

  const deleteMutation = useMutation({
    mutationFn: deleteRecommendation,
    onSuccess: (response) => {
      if (!response.success || !response.data) {
        toast("Failed to delete recommendation.", "error");
        return;
      }
      queryClient.setQueriesData(
        { queryKey: ["recommendations", supervisor.id] },
        (oldData: RecommendationWithAuthor[] = []) =>
          oldData.filter((r) => r.id !== response.data.deletedId),
      );
      toast("Recommendation deleted successfully.", "success");
    },
    onError: (error) => toast(error.message, "error"),
  });

  return (
    <ListPageCardShell
      authorHref={`/scholars/${recommendation.author.id}`}
      authorName={recommendation.isAnonymous ? "Anonymous Scholar" : (recommendation.author.name || "Scholar")}
      authorId={recommendation.author.id}
      isFollowing={isFollowing}
      currentUserId={currentUserId}
      authorHandle={recommendation.isAnonymous ? undefined : (recommendation.author.handle || undefined)}
      authorAvatarUrl={recommendation.isAnonymous ? null : (recommendation.author.avatarUrl || undefined)}
      detailPageHref={`/supervisor/${supervisor.id}/recommendation/${recommendation.id}`}
      managementControls={
        isOwner && (
          <OwnerActionsDropdown
            editHref={`/supervisor/${supervisor.id}/recommendation/${recommendation.id}/edit`}
            onDelete={() => { deleteMutation.mutate(recommendation.id); return { refresh: false }; }}
            isOwner={isOwner}
            editLabel="Edit Recommendation"
            deleteLabel="Delete Recommendation"
          />
        )
      }
      createdDate={recommendation.createdAt}
      footerVoteButton={
        <VoteButton
          targetId={recommendation.id}
          type="recommendation"
          initialUpvotes={upvoteCount}
          initialDownvotes={downvoteCount}
          initialUserVote={userVote}
        />
      }
      footerCommentsHref={`/supervisor/${supervisor.id}/recommendation/${recommendation.id}`}
      footerCommentsCount={recommendation._count.comments}
    >
      <p className="text-sm font-semibold text-slate-700 mb-2">
        {recommendation.isAnonymous ? "Anonymous recommendation for " : "Recommendation for "}
        <span className="text-blue-700">{supervisor.name}</span>
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
            <StarRating rating={recommendation.responsivenessScore} size="sm" />
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
    </ListPageCardShell>
  );
}
