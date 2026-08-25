import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { CommentSection } from "@/components/interactions/CommentSection";
import type { CommentWithAuthorAndVotes } from "@/types/comments";
import { VoteButton } from "@/components/interactions/VoteButton";
import {
  deleteRecommendation,
  getRecommendation,
} from "@/app/actions/recommendations";
import DetailPageCardShell from "@/components/cards/DetailPageCardShell";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";
import { StarRating } from "@/components/ui/StarRating";
import { RichContent } from "@/components/content/RichContent";

import { buildMetadata } from "@/lib/seo";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; recommendationId: string }>;
}): Promise<Metadata> {
  const { id, recommendationId } = await params;
  const rec = await getRecommendation(recommendationId).catch(() => null);
  if (!rec || rec.supervisor.id !== id) return { title: "Recommendation" };
  return buildMetadata({
    title: `Recommendation for ${rec.supervisor.name || "Supervisor"}`,
    description: `A ${rec.rating ? `${rec.rating}/5 ` : ""}mentorship recommendation. ${(rec.feedback || "").replace(/<[^>]*>/g, " ")}`,
    path: `/supervisor/${rec.supervisor.id}/recommendation/${rec.id}`,
    type: "article",
    publishedTime: rec.createdAt,
    section: "Supervisor Recommendations",
  });
}

export default async function RecommendationDetailPage({
  params,
}: {
  params: Promise<{ id: string; recommendationId: string }>;
}) {
  const { id, recommendationId } = await params;
  const user = await getCurrentUser();

  const recommendation = await getRecommendation(recommendationId, user?.id);

  if (!recommendation || recommendation.supervisor.id !== id) {
    notFound();
  }

  async function handleDelete() {
    "use server";
    await deleteRecommendation(recommendation!.id);
    return { redirect: `/supervisor/${id}` };
  }

  // Filtered select in getRecommendation returns at most one row (the
  // current user's vote) — no full vote-array scan needed.
  const userVote =
    (recommendation.votes?.[0]?.voteType as "UPVOTE" | "DOWNVOTE" | null) ??
    null;

  return (
    <DetailPageCardShell
      backHref={`/supervisor/${recommendation.supervisor.id}`}
      backLabel="Back to Supervisor Profile"
      authorHref={
        recommendation.isAnonymous
          ? undefined
          : `/scholars/${recommendation.author.id}`
      }
      authorName={
        recommendation.isAnonymous
          ? "Anonymous Scholar"
          : recommendation.author.name || "Scholar"
      }
      authorHandle={
        recommendation.isAnonymous
          ? undefined
          : recommendation.author.handle || undefined
      }
      authorAvatarUrl={
        recommendation.isAnonymous
          ? null
          : recommendation.author.avatarUrl || undefined
      }
      authorId={
        recommendation.isAnonymous ? undefined : recommendation.authorId
      }
      currentUserId={user?.id}
      createdDate={recommendation.createdAt}
      footerVoteButton={
        <VoteButton
          targetId={recommendation.id}
          module="RECOMMENDATION"
          initialTotalVotes={recommendation.totalVotes}
          initialUserVote={userVote}
        />
      }
      footerCommentsHref={`/supervisor/${recommendation.supervisor.id}/recommendation/${recommendation.id}#comments`}
      footerCommentsCount={recommendation.totalComments}
      discussion={
        <CommentSection
          comments={recommendation.comments as CommentWithAuthorAndVotes[]}
          targetId={recommendation.id}
          module="recommendation"
          currentUserId={user?.id ?? null}
          postAuthorId={recommendation.authorId}
        />
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
      {recommendation.isAnonymous ? (
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
          Anonymous recommendation
        </p>
      ) : null}
      <p className="text-sm font-semibold text-slate-700 mb-2">
        Recommendation for{" "}
        <a
          href={`/supervisor/${recommendation.supervisor.id}`}
          className="text-blue-700 hover:underline"
        >
          {recommendation.supervisor.name}
        </a>
      </p>
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
