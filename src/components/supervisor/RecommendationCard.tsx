"use client";
import { LikeButton } from "@/components/interactions/LikeButton";
import { Recommendation, RecommendationLike, User } from "@prisma/client";
import ListPageCardShell from "@/components/cards/ListPageCardShell";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";
import { deleteRecommendation } from "@/app/actions/recommendations";

type RecommendationCardProps = Recommendation & {
  author: User;
  likes: RecommendationLike[];
  _count: {
    comments: number;
    likes: number;
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
  const isLiked = !!recommendation.likes?.find(
    (like) => like.userId === currentUserId,
  );

  const isOwner = currentUserId === recommendation.author.id;

  async function handleDelete() {
    await deleteRecommendation(recommendation.id);
  }

  return (
    <ListPageCardShell
      authorHref={`/scholar/${recommendation.author.id}`}
      authorName={recommendation.author.name || "Scholar"}
      authorHandle={recommendation.author.handle || undefined}
      authorAvatarUrl={recommendation.author.avatarUrl || undefined}
      detailPageHref={`/supervisor/${supervisor.id}/recommendation/${recommendation.id}`}
      managementControls={
        <OwnerActionsDropdown
          editHref={`/supervisor/${supervisor.id}/recommendation/${recommendation.id}/edit`}
          onDelete={handleDelete}
          isOwner={isOwner}
          editLabel="Edit Recommendation"
          deleteLabel="Delete Recommendation"
        />
      }
      footerLikeButton={
        <LikeButton
          targetId={recommendation.id}
          type="recommendation"
          initialLikes={recommendation._count.likes}
          initialIsLiked={isLiked}
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

      <p className="text-sm leading-relaxed text-slate-600 whitespace-pre-wrap line-clamp-4">
        {`Mentorship Feedback: ${recommendation.feedback}`}
      </p>
    </ListPageCardShell>
  );
}
