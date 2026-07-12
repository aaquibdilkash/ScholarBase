"use client";
import { LikeButton } from "@/components/interactions/LikeButton";
import { CommentIcon } from "@/components/icons/CommentIcon";
import { Recommendation, RecommendationLike, User } from "@prisma/client";
import Link from "next/link";
import Image from "next/image";

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

  return (
    // 1. Changed the outer wrapper from <Link> to a standard <div>
    <div
      key={recommendation.id}
      className="sb-card sb-card-hover group flex flex-col h-full"
    >
      <div className="flex items-center gap-2 mb-2">
        {/* 2. Removed stopPropagation() since these are no longer nested! */}
        <Link href={`/scholar/${recommendation.author.id}`}>
          <div className="w-8 h-8 rounded-full bg-slate-100 border overflow-hidden hover:ring-2 hover:ring-blue-200 transition">
            {recommendation.author.avatarUrl ? (
              <Image
                src={recommendation.author.avatarUrl}
                alt="User"
                width={32}
                height={32}
                unoptimized
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center font-bold text-slate-500 text-xs">
                {recommendation.author.name?.charAt(0).toUpperCase() || "?"}
              </div>
            )}
          </div>
        </Link>
        <div className="text-sm">
          <Link
            href={`/scholar/${recommendation.author.id}`}
            className="font-semibold text-slate-900 hover:text-blue-600 hover:underline"
          >
            {recommendation.author.name}
          </Link>
          <p className="text-slate-500">
            Recommends{" "}
            <Link
              href={`/supervisor/${supervisor.id}`}
              className="font-semibold text-slate-900 hover:text-blue-600 hover:underline"
            >
              {supervisor.name}
            </Link>
          </p>
        </div>
      </div>
      <p className="mb-4 text-sm text-slate-500">{recommendation.content}</p>

      <div className="mt-auto border-t border-slate-100 pt-4 flex justify-end items-center">
        <div className="flex items-center gap-4">
          <LikeButton
            targetId={recommendation.id}
            type="recommendation"
            initialLikes={recommendation._count.likes}
            initialIsLiked={isLiked}
          />
          {/* 3. Moved the main recommendation link down here to match the SupervisorCard */}
          <Link
            href={`/recommendation/${recommendation.id}`}
            className="text-sm font-medium hover:text-blue-600 transition flex items-center gap-2"
          >
            <CommentIcon className="h-5 w-5" /> {recommendation._count.comments}
          </Link>
        </div>
      </div>
    </div>
  );
}
