"use client";
import { VoteButton } from "@/components/interactions/VoteButton";
import { Recommendation, User } from "@prisma/client";
import ListPageCardShell from "@/components/cards/ListPageCardShell";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";
import { deleteRecommendation } from "@/app/actions/recommendations";
import { RichContent } from "@/components/content/RichContent";
import { StarRating } from "@/components/ui/StarRating";

type RecommendationCardProps = Recommendation & {
  author: User & {
    followers?: { followerId: string }[];
  };
  votes: any[];
  _count: {
    comments: number;
    votes: number;
  };
};

export function RecommendationCard({
  recommendation,
  supervisor,
  currentUserId,
}: {
  recommendation: RecommendationCardProps;
  supervisor: { id: string; name: string | null };
  currentUserId?: string;
}) {
  const userVote: "UPVOTE" | "DOWNVOTE" | null =
    recommendation.votes?.find((v: any) => v.userId === currentUserId)
      ?.voteType ?? null;
  const upvoteCount =
    recommendation.votes?.filter((v: any) => v.voteType === "UPVOTE").length ??
    0;
  const downvoteCount =
    recommendation.votes?.filter((v: any) => v.voteType === "DOWNVOTE")
      .length ?? 0;

  const isOwner = currentUserId === recommendation.author.id;
  const isFollowing = (recommendation.author.followers?.length ?? 0) > 0;

  async function handleDelete() {
    await deleteRecommendation(recommendation.id);
  }

  return (
    <ListPageCardShell
      authorHref={`/scholars/${recommendation.author.id}`}
      authorName={recommendation.author.name || "Scholar"}
      authorId={recommendation.author.id}
      isFollowing={isFollowing}
      currentUserId={currentUserId}
      authorHandle={recommendation.author.handle || undefined}
      authorAvatarUrl={recommendation.author.avatarUrl || undefined}
      detailPageHref={`/supervisor/${supervisor.id}/recommendation/${recommendation.id}`}
      managementControls={
        isOwner && (
          <OwnerActionsDropdown
            editHref={`/supervisor/${supervisor.id}/recommendation/${recommendation.id}/edit`}
            onDelete={handleDelete}
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
      <div className="space-y-3 mb-4">
        <div>
          <p className="text-xs font-semibold text-slate-700 mb-1">
            Overall Mentorship Rating
          </p>
          <StarRating rating={recommendation.rating} size="md" />
        </div>
        <div className="grid grid-cols-3 gap-x-4">
          <div>
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
