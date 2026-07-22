import Link from "next/link";

import { getCurrentUser } from "@/lib/auth";
import { CommentSection } from "@/components/interactions/CommentSection";
import { VoteButton } from "@/components/interactions/VoteButton";

import { RecommendationCard } from "@/components/supervisor/RecommendationCard";
import { deleteSupervisor, getSupervisor } from "@/app/actions/supervisors";
import DetailPageCardShell from "@/components/cards/DetailPageCardShell";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";

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

  async function handleDelete() {
    "use server";
    await deleteSupervisor(supervisor!.id);
  }

  // Compute vote counts from votes array
  const upvotes =
    (supervisor.votes as any[])?.filter((v: any) => v.voteType === "UPVOTE")
      .length ?? 0;
  const downvotes =
    (supervisor.votes as any[])?.filter((v: any) => v.voteType === "DOWNVOTE")
      .length ?? 0;
  const userVote =
    ((supervisor.votes as any[])?.find((v: any) => v.userId === user?.id)
      ?.voteType as "UPVOTE" | "DOWNVOTE" | null) ?? null;

  const hasUserRecommendation =
    !!user && supervisor.recommendations.some((r) => r.authorId === user.id);
  const isFollowing = (supervisor.author.followers?.length ?? 0) > 0;

  return (
    <DetailPageCardShell
      backHref="/supervisor"
      backLabel="Back to Search"
      authorId={supervisor.authorId}
      isFollowing={isFollowing}
      authorHref={`/scholar/${supervisor.authorId}`}
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
        <div
          className="mt-8 sb-surface-strong p-8 md:p-12 rounded-xl"
          id="comments"
        >
          <h3 className="text-2xl font-bold text-slate-900 mb-6">Discussion</h3>
          <CommentSection
            comments={supervisor.comments}
            targetId={supervisor.id}
            type="supervisor"
            currentUserId={user?.id ?? null}
            postAuthorId={supervisor.authorId}
          />
        </div>
      }
    >
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200/60 p-8 md:p-10 mb-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight mb-2">
              {supervisor.name}
            </h1>
            <p className="text-lg text-slate-500 font-medium">
              {supervisor.university}
            </p>
            {supervisor.department && (
              <p className="text-sm text-slate-400 mt-1">
                {supervisor.department}
              </p>
            )}
            {supervisor.about && (
              <p className="mt-4 text-sm leading-6 text-slate-700">
                {supervisor.about}
              </p>
            )}
          </div>

          {!hasUserRecommendation && (
            <Link
              href={`/supervisor/${supervisor.id}/recommendation/add`}
              className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold shadow-sm shadow-blue-600/20 hover:bg-blue-700 hover:shadow-md hover:shadow-blue-600/30 transition-all duration-200 whitespace-nowrap"
            >
              + Recommend
            </Link>
          )}
        </div>
      </div>

      {/* Recommendations List */}
      <div className="space-y-6 mb-12">
        <h3
          className="text-2xl font-bold text-slate-900 mb-6"
          id="recommendations"
        >
          Recommendations ({supervisor.recommendations.length})
        </h3>
        {supervisor.recommendations.length === 0 ? (
          <p className="text-slate-500 bg-white p-8 rounded-2xl border border-slate-200/60 text-center">
            No recommendations yet. Be the first to share your experience!
          </p>
        ) : (
          <div className="overflow-x-auto pb-4 snap-x snap-mandatory">
            <div className="flex gap-6">
              {supervisor.recommendations.map((r) => (
                <div key={r.id} className="w-full flex-shrink-0 snap-center">
                  <RecommendationCard
                    recommendation={r}
                    supervisor={supervisor}
                    currentUserId={user?.id}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </DetailPageCardShell>
  );
}
