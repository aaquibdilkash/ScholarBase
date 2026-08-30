import { getCurrentUser } from "@/lib/auth";
import { CommentSection } from "@/components/interactions/CommentSection";
import { VoteButton } from "@/components/interactions/VoteButton";

import { RecommendButton } from "@/components/supervisor/RecommendButton";
import { RecommendationsSection } from "@/components/supervisor/RecommendationsSection";
import { OverallRatingSection } from "@/components/supervisor/OverallRatingSection";
import {
  deleteSupervisor,
  getSupervisor,
  getSupervisorRecommendationMeta,
} from "@/app/actions/supervisors";
import DetailPageCardShell from "@/components/cards/DetailPageCardShell";
import { ReportMenu } from "@/components/cards/ReportMenu";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";
import { RichContent } from "@/components/content/RichContent";

import { buildMetadata } from "@/lib/seo";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supervisor = await getSupervisor(id).catch(() => null);
  if (!supervisor) return { title: "PhD Supervisor" };
  const name = supervisor.name || "PhD Supervisor";
  const university = supervisor.university
    ? ` at ${supervisor.university}`
    : "";
  return buildMetadata({
    title: `${name}${university} - PhD Supervisor`,
    description: (
      supervisor.about ||
      `Profiles, ratings, and recommendations for PhD supervisor ${supervisor.name || ""}.`
    ).replace(/<[^>]*>/g, " "),
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
    return { redirect: "/supervisor" };
  }

  const userVote =
    (supervisor.votes?.find((v) => v.userId === user?.id)?.voteType as
      "UPVOTE" | "DOWNVOTE" | null) ?? null;

  const hasUserRecommendation = recMeta.hasUserRecommendation;
  const isFollowing = (supervisor.author?.followers?.length ?? 0) > 0;

  const recommendationCount = recMeta.totalCount;
  const avgRating = recMeta.avgRating;
  const ratingDistribution = recMeta.ratingDistribution;

  return (
    <DetailPageCardShell
      isFrozen={supervisor.isFrozen ?? false}
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
      footerCommentsCount={supervisor.totalComments}
      footerReportMenu={
        <ReportMenu
          entityId={supervisor.id}
          entityType="POST"
          module="SUPERVISOR"
          ownerId={supervisor.author?.id ?? null}
          currentUserId={user?.id ?? null}
          isFrozen={supervisor.isFrozen}
          isDeleted={false}
          hasActiveAppeal={supervisor.hasActiveAppeal}
        />
      }
      footerVoteButton={
        <VoteButton
          targetId={supervisor.id}
          module="SUPERVISOR"
          initialTotalVotes={supervisor.totalVotes}
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
          locked={supervisor.isFrozen ?? false}
          comments={supervisor.comments}
          totalComments={supervisor.totalComments}
          targetId={supervisor.id}
          module="supervisor"
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

          <RecommendButton
            supervisorId={supervisor.id}
            currentUserId={user?.id}
            initialHasRecommendation={hasUserRecommendation}
            initialUserRecommendationId={recMeta.userRecommendationId}
          />
        </div>
      </div>

      <OverallRatingSection
        supervisorId={supervisor.id}
        initialCount={recommendationCount}
        initialAvgRating={avgRating}
        initialDistribution={ratingDistribution}
      />

      {/* Recommendations List — reactive count/empty-state, no server refetch */}
      <RecommendationsSection
        supervisorId={supervisor.id}
        supervisorName={supervisor.name}
        initialRecommendations={supervisor.recommendations}
        initialCount={recommendationCount}
        currentUserId={user?.id}
      />
    </DetailPageCardShell>
  );
}
