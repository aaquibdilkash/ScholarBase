import { LikeButton } from "@/components/interactions/LikeButton";
import { CommentIcon } from "@/components/icons/CommentIcon";
import { Recommendation, Supervisor, SupervisorLike } from "@prisma/client";
import Link from "next/link";

type SupervisorCardProps = Supervisor & {
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
    <div
      key={supervisor.id}
      className="sb-card sb-card-hover group flex flex-col"
    >
      <h2 className="mb-2 text-lg font-semibold leading-tight text-slate-950">
        <Link href={`/supervisor/${supervisor.id}`}>{supervisor.name}</Link>
      </h2>
      <p className="mb-2 text-sm font-medium text-slate-600">
        {supervisor.university}
      </p>
      <p className="mb-4 text-sm text-slate-500">{supervisor.department}</p>

      <div className="mt-auto border-t border-slate-100 pt-4 flex justify-between items-center">
        <div className="text-sm">
          <span className="font-semibold">{avgRating}</span>
          <span className="text-slate-500"> / 5</span>
          <span className="text-slate-500 ml-2">
            ({recommendationCount} recommendations)
          </span>
        </div>
        <div className="flex items-center gap-4">
          <LikeButton
            targetId={supervisor.id}
            type="supervisor"
            initialLikes={supervisor._count.likes}
            initialIsLiked={isLiked}
          />
          <Link
            href={`/supervisor/${supervisor.id}#comments`}
            className="text-sm font-medium hover:text-blue-600 transition flex items-center gap-2"
          >
            <CommentIcon className="h-5 w-5" /> {supervisor._count.comments}
          </Link>
        </div>
      </div>
    </div>
  );
}
