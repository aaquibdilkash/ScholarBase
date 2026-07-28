"use client";
import { VoteButton } from "@/components/interactions/VoteButton";
import { Recommendation, User } from "@prisma/client";
import ListPageCardShell from "@/components/cards/ListPageCardShell";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";
import { deleteRecommendation } from "@/app/actions/recommendations";
import { RichContent } from "@/components/content/RichContent";

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
      authorHref={`/scholar/${recommendation.author.id}`}
      authorName={recommendation.author.name || "Scholar"}
      authorId={recommendation.author.id}
      isFollowing={isFollowing}
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
      <p className="mb-2 text-sm font-semibold text-slate-900">
        {`Mentorship Rating: ${recommendation.rating}/5`}
      </p>

      <div className="mb-4 text-sm text-slate-700 space-y-1">
        <p>{`Turnaround Time: ${recommendation.turnaroundTimeDays} day(s)`}</p>
        <p>{`Responsiveness: ${recommendation.responsivenessScore}/5`}</p>
        <p>{`Guidance Quality: ${recommendation.guidanceScore}/5`}</p>
      </div>

      <p className="text-sm font-semibold text-slate-700 mb-1">
        Mentorship Feedback:
      </p>
      <RichContent
        content={recommendation.feedback}
        className="text-sm leading-relaxed text-slate-600 line-clamp-4"
      />
    </ListPageCardShell>
  );
}
