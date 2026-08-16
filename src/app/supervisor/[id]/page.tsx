import Link from "next/link";

import { getCurrentUser } from "@/lib/auth";
import { CommentSection } from "@/components/interactions/CommentSection";
import { VoteButton } from "@/components/interactions/VoteButton";

import { SupervisorRecommendations } from "@/components/supervisor/SupervisorRecommendations";
import {
  deleteSupervisor,
  getSupervisor,
  getSupervisorRecommendationMeta,
} from "@/app/actions/supervisors";
import DetailPageCardShell from "@/components/cards/DetailPageCardShell";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";
import { StarRating } from "@/components/ui/StarRating";
import { RichContent } from "@/components/content/RichContent";

import { buildMetadata } from "@/lib/seo";
import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const supervisor = await getSupervisor(id).catch(() => null);
  if (!supervisor) return { title: "PhD Supervisor" };
  const name = supervisor.name || "PhD Supervisor";
  const university = supervisor.university ? ` at ${supervisor.university}` : "";
  return buildMetadata({
    title: `${name}${university} - PhD Supervisor`,
    description: (supervisor.about || `Profiles, ratings, and recommendations for PhD supervisor ${supervisor.name || ""}.`).replace(/<[^>]*>/g, " "),
    path: `/supervisor/${supervisor.id}`,
    type: "profile",
    author: supervisor.author?.name || undefined,
    publishedTime: supervisor.createdAt,
    section: "Supervisors",
  });
}

export default async function SupervisorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();

  const supervisor = await getSupervisor(id, user?.id);

  if (!supervisor)
    return (
      <div className="p-8 text-center text-slate-500 font-medium">
        Supervisor not found
      </div>
    );

  const recMeta = await getSupervisorRecommendationMeta(id, user?.id);

  async function handleDelete() {
    "use server";
    await deleteSupervisor(supervisor!.id);
  }

  // Compute vote counts from votes array
  const upvotes =
    supervisor.votes?.filter((v) => v.voteType === "UPVOTE").length ?? 0;
  const downvotes =
    supervisor.votes?.filter((v) => v.voteType === "DOWNVOTE").length ?? 0;
  const userVote =
    (supervisor.votes?.find((v) => v.userId === user?.id)?.voteType as
      | "UPVOTE"
      | "DOWNVOTE"
      | null) ?? null;

  const hasUserRecommendation = recMeta.hasUserRecommendation;
  const isFollowing = (supervisor.author.followers?.length ?? 0) > 0;

  const recommendationCount = recMeta.totalCount;
  const avgRating = recMeta.avgRating;
  const ratingDistribution = recMeta.ratingDistribution;

  return (
    <DetailPageCardShell
      backHref="/supervisor"
      backLabel="Back to Search"
      authorId={supervisor.authorId}
      isFollowing={isFollowing}
      currentUserId={user?.id}
      authorHref={`/scholars/${supervisor.authorId}`}
      authorName={supervisor.author?.name || "Scholar"}
      authorHandle={supervisor.author?.handle || undefined}
      authorAvatarUrl={supervisor.author?.avatarUrl || undefined}
      createdDate={supervisor.createdAt}
      footerCommentsHref={`/supervisor/${supervisor.id}#comments`}
      footerCommentsCount={supervisor.comments.length}
      footerVoteButton={
        <VoteButton
          targetId={supervisor.id}
          type="supervisor"
          initialUpvotes={upvotes}
          initialDownvotes={downvotes}
          initialUserVote={userVote}
        />
      }
      managementControls={
        user?.id === supervisor.authorId ? (
          <OwnerActionsDropdown
            editHref={`/supervisor/${supervisor.id}/edit`}
            onDelete={handleDelete}
            isOwner={true}
            editLabel="Edit Profile"
            deleteLabel="Delete"
          />
        ) : null
      }
      discussion={
        <CommentSection
          comments={supervisor.comments}
          targetId={supervisor.id}
          type="supervisor"
          currentUserId={user?.id ?? null}
          postAuthorId={supervisor.authorId}
        />
      }
    >
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-slate-200/60 p-4 sm:p-6 md:p-8 lg:p-10 mb-6 sm:mb-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 sm:gap-6">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight mb-1.5 sm:mb-2">
              {supervisor.name}
            </h1>
            <p className="text-base sm:text-lg text-slate-500 font-medium">
              {supervisor.university}
            </p>
            {supervisor.department && (
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                {supervisor.department}
              </p>
            )}
            {supervisor.about && (
              <RichContent
                content={supervisor.about}
                className="mt-3 sm:mt-4 text-xs sm:text-sm leading-6 text-slate-700"
              />
            )}
          </div>

          {!hasUserRecommendation && (
            <Link
              href={`/supervisor/${supervisor.id}/recommendation/add`}
              className="sb-button-primary w-full md:w-auto"
            >
              + Recommend
            </Link>
          )}
        </div>
      </div>

      {recommendationCount > 0 && (
        <div className="bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-slate-200/60 p-3 sm:p-4 md:p-5 lg:p-6 mb-6 sm:mb-8">
          <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-900 mb-3 sm:mb-4">
            Overall Rating
          </h3>
          <div className="flex flex-col md:flex-row items-center gap-2 sm:gap-3 md:gap-4">
            <div className="flex flex-col items-center justify-center text-center">
              <p className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-slate-900">
                {avgRating.toFixed(1)}
              </p>
              <StarRating rating={avgRating} size="sm" />
              <p className="text-xs sm:text-sm text-slate-500 mt-1.5 sm:mt-2">
                ({recommendationCount} ratings)
              </p>
            </div>
            <div className="w-full flex-1 space-y-1 sm:space-y-1.5">
              {ratingDistribution.map((item) => (
                <div
                  key={item.stars}
                  className="flex items-center gap-2 sm:gap-3"
                >
                  <span className="text-xs sm:text-sm font-semibold text-slate-600 w-14 sm:w-16">
                    {item.stars} star
                  </span>
                  <div className="w-full bg-slate-100 rounded-full h-1 sm:h-1.5">
                    <div
                      className="bg-yellow-400 h-1 sm:h-1.5 rounded-full"
                      style={{ width: `${item.percentage}%` }}
                    ></div>
                  </div>
                  <span className="text-xs sm:text-sm font-medium text-slate-500 w-10 sm:w-12 text-right">
                    {item.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Recommendations List */}
      <div className="space-y-4 sm:space-y-6 mb-4 sm:mb-6">
        <h3
          className="text-lg sm:text-xl md:text-2xl font-bold text-slate-900 mb-4 sm:mb-6"
          id="recommendations"
        >
          Recommendations ({recommendationCount})
        </h3>
        {recommendationCount === 0 ? (
          <p className="text-slate-500 bg-white p-8 rounded-2xl border border-slate-200/60 text-center">
            No recommendations yet. Be the first to share your experience!
          </p>
        ) : (
          <SupervisorRecommendations
            initialRecommendations={supervisor.recommendations}
            totalCount={recommendationCount}
            supervisor={supervisor}
            currentUserId={user?.id}
          />
        )}
      </div>
    </DetailPageCardShell>
  );
}
