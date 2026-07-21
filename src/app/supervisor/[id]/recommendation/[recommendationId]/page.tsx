import prisma from "@/lib/db";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { CommentSection } from "@/components/interactions/CommentSection";
import { LikeButton } from "@/components/interactions/LikeButton";
import { deleteRecommendation } from "@/app/actions/recommendations";
import DetailPageCardShell from "@/components/cards/DetailPageCardShell";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";

export default async function RecommendationDetailPage({
  params,
}: {
  params: Promise<{ id: string; recommendationId: string }>;
}) {
  const { id, recommendationId } = await params;
  const user = await getCurrentUser();

  const recommendation = await prisma.recommendation.findUnique({
    where: { id: recommendationId },
    include: {
      author: true,
      supervisor: true,
      comments: {
        where: { parentId: null },
        orderBy: { createdAt: "asc" },
        include: {
          author: true,
          likes: { where: { userId: user?.id } },
          _count: { select: { likes: true } },
          replies: {
            orderBy: { createdAt: "asc" },
            include: {
              author: true,
              likes: { where: { userId: user?.id } },
              _count: { select: { likes: true } },
            },
          },
        },
      },
      likes: { where: { userId: user?.id } },
      _count: { select: { likes: true, comments: true } },
    },
  });

  if (!recommendation || recommendation.supervisor.id !== id) {
    notFound();
  }

  async function handleDelete() {
    "use server";
    await deleteRecommendation(recommendation!.id);
  }

  const isLiked = !!user && recommendation.likes?.length > 0;

  return (
    <DetailPageCardShell
      backHref={`/supervisor/${recommendation.supervisor.id}`}
      backLabel="Back to Supervisor Profile"
      authorHref={`/scholar/${recommendation.author.id}`}
      authorName={recommendation.author.name || "Scholar"}
      authorHandle={recommendation.author.handle || undefined}
      authorAvatarUrl={recommendation.author.avatarUrl || undefined}
      footerLikeButton={
        <LikeButton
          targetId={recommendation.id}
          type="recommendation"
          initialLikes={recommendation._count.likes}
          initialIsLiked={isLiked}
        />
      }
      footerCommentsHref={`/supervisor/${recommendation.supervisor.id}/recommendation/${recommendation.id}#comments`}
      footerCommentsCount={recommendation._count.comments}
      discussion={
        <div className="mt-8 sb-surface-strong p-8 md:p-12 rounded-xl" id="comments">
          <h3 className="text-2xl font-bold text-slate-900 mb-6">Discussion</h3>
          <CommentSection
            comments={recommendation.comments}
            targetId={recommendation.id}
            type="recommendation"
            currentUserId={user?.id ?? null}
          />
        </div>
      }
      managementControls={
        user?.id === recommendation.authorId ? (
          <OwnerActionsDropdown
            editHref={`/supervisor/${id}/recommendation/${recommendationId}/edit`}
            onDelete={handleDelete}
            isOwner={true}
            editLabel="Edit Recommendation"
            deleteLabel="Delete"
          />
        ) : null
      }
    >
        
        <p className="mb-2 text-sm font-semibold text-slate-900">
          {`Mentorship Rating: ${recommendation.rating}/5`}
        </p>

        <div className="mb-6 text-sm text-slate-700 space-y-1">
          <p>{`Turnaround Time: ${recommendation.turnaroundTimeDays} day(s)`}</p>
          <p>{`Responsiveness: ${recommendation.responsivenessScore}/5`}</p>
          <p>{`Guidance Quality: ${recommendation.guidanceScore}/5`}</p>
        </div>

        <p className="mb-8 text-slate-600 whitespace-pre-wrap">
          {`Mentorship Feedback: ${recommendation.feedback}`}
        </p>

        
    </DetailPageCardShell>
  );
}
