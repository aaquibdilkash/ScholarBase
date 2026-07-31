import prisma from "@/lib/db";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { CommentSection } from "@/components/interactions/CommentSection";
import { VoteButton } from "@/components/interactions/VoteButton";
import { deleteRecommendation } from "@/app/actions/recommendations";
import DetailPageCardShell from "@/components/cards/DetailPageCardShell";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";
import { StarRating } from "@/components/ui/StarRating";
import { RichContent } from "@/components/content/RichContent";

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
          votes: user ? { where: { userId: user.id } } : false,
          _count: { select: { votes: true } },
          replies: {
            orderBy: { createdAt: "asc" },
            include: {
              author: true,
              votes: user ? { where: { userId: user.id } } : false,
              _count: { select: { votes: true } },
            },
          },
        },
      },
      votes: { select: { userId: true, voteType: true } },
      _count: { select: { votes: true, comments: true } },
    },
  });

  if (!recommendation || recommendation.supervisor.id !== id) {
    notFound();
  }

  async function handleDelete() {
    "use server";
    await deleteRecommendation(recommendation!.id);
  }

  const upvotes =
    recommendation.votes?.filter((v: any) => v.voteType === "UPVOTE").length ??
    0;
  const downvotes =
    recommendation.votes?.filter((v: any) => v.voteType === "DOWNVOTE")
      .length ?? 0;
  const userVote =
    (recommendation.votes?.find((v: any) => v.userId === user?.id)?.voteType as
      | "UPVOTE"
      | "DOWNVOTE"
      | null) ?? null;

  return (
    <DetailPageCardShell
      backHref={`/supervisor/${recommendation.supervisor.id}`}
      backLabel="Back to Supervisor Profile"
      authorHref={`/scholar/${recommendation.author.id}`}
      authorName={recommendation.author.name || "Scholar"}
      authorHandle={recommendation.author.handle || undefined}
      authorAvatarUrl={recommendation.author.avatarUrl || undefined}
      createdDate={recommendation.createdAt}
      footerVoteButton={
        <VoteButton
          targetId={recommendation.id}
          type="recommendation"
          initialUpvotes={upvotes}
          initialDownvotes={downvotes}
          initialUserVote={userVote}
        />
      }
      footerCommentsHref={`/supervisor/${recommendation.supervisor.id}/recommendation/${recommendation.id}#comments`}
      footerCommentsCount={recommendation._count.comments}
      discussion={
        <div
          className="mt-4 sm:mt-6 p-4 sm:p-6 md:p-8 md:mt-8 sb-surface-strong rounded-xl"
          id="comments"
        >
          <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-900 mb-3 sm:mb-4 md:mb-6">Discussion</h3>
          <CommentSection
            comments={recommendation.comments}
            targetId={recommendation.id}
            type="recommendation"
            currentUserId={user?.id ?? null}
            postAuthorId={recommendation.authorId}
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
      <div className="space-y-3 mb-4">
        <div>
          <p className="text-xs font-semibold text-slate-700 mb-1">
            Overall Mentorship Rating
          </p>
          <div className="flex items-center gap-2">
            <StarRating rating={recommendation.rating} size="md" />
            <span className="font-bold text-slate-800">
              {recommendation.rating.toFixed(1)} / 5
            </span>
          </div>
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
        <p className="text-base sm:text-lg font-semibold text-slate-800 mb-2 sm:mb-3">
          Mentorship Feedback
        </p>
        <RichContent
          content={recommendation.feedback}
          className="text-slate-700 leading-relaxed"
        />
      </div>
    </DetailPageCardShell>
  );
}
