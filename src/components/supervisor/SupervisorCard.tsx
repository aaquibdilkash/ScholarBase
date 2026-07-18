"use client";
import { LikeButton } from "@/components/interactions/LikeButton";
import {
  Recommendation,
  Supervisor,
  SupervisorLike,
  User,
} from "@prisma/client";
import ListPageCardShell from "@/components/cards/ListPageCardShell";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";
import { deleteSupervisor } from "@/app/actions/supervisors";

type SupervisorCardProps = Supervisor & {
  author: User;
  recommendations: Recommendation[];
  likes: SupervisorLike[];
  _count: {
    comments: number;
    likes: number;
  };
};

export function SupervisorCard({
  supervisor,
  currentUserId,
}: {
  supervisor: SupervisorCardProps;
  currentUserId?: string;
}) {
  const isOwner = currentUserId === supervisor.authorId;
  const recommendationCount = supervisor.recommendations.length;

  const avgRating =
    recommendationCount > 0
      ? (
          supervisor.recommendations.reduce((sum, rec) => {
            return sum + rec.rating;
          }, 0) / recommendationCount
        ).toFixed(1)
      : "No recommendations";

  const isLiked = !!supervisor.likes?.find(
    (like) => like.userId === currentUserId,
  );

  return (
    <ListPageCardShell
      authorHref={`/scholar/${supervisor.author.id}`}
      authorName={supervisor.author.name || "Supervisor"}
      authorHandle={supervisor.author.handle || undefined}
      authorAvatarUrl={supervisor.author.avatarUrl || undefined}
      detailPageHref={`/supervisor/${supervisor.id}`}
      managementControls={
        isOwner && (
          <OwnerActionsDropdown
            editHref={`/supervisor/${supervisor.id}/edit`}
            isOwner={true}
            editLabel="Edit Supervisor"
            deleteLabel="Delete"
            onDelete={async () => {
              await deleteSupervisor(supervisor.id);
            }}
          />
        )
      }
      footerLikeButton={
        <LikeButton
          targetId={supervisor.id}
          type="supervisor"
          initialLikes={supervisor._count.likes}
          initialIsLiked={isLiked}
        />
      }
      footerCommentsHref={`/supervisor/${supervisor.id}#comments`}
      footerCommentsCount={supervisor._count.comments}
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

      <div className="rounded-xl border border-slate-100 bg-white p-3">
        <div className="text-sm">
          <span className="font-semibold">{avgRating}</span>
          <span className="text-slate-500"> / 5</span>
          <span className="text-slate-500 ml-2">
            ({recommendationCount} recommendations)
          </span>
        </div>
      </div>
    </ListPageCardShell>
  );
}
