import { notFound } from "next/navigation";
import { CommentSection } from "@/components/interactions/CommentSection";
import { createClient } from "@/utils/supabase/server";
import { VoteButton } from "@/components/interactions/VoteButton";

import {
  deleteContribution,
  getContribution,
} from "@/app/actions/contributions";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";
import DetailPageCardShell from "@/components/cards/DetailPageCardShell";
import { RichContent } from "@/components/content/RichContent";

const ContributionDetailPage = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const contribution = await getContribution(id, user?.id);

  if (!contribution) {
    notFound();
  }

  const upvotes =
    contribution.votes?.filter((v: any) => v.voteType === "UPVOTE").length ?? 0;
  const downvotes =
    contribution.votes?.filter((v: any) => v.voteType === "DOWNVOTE").length ??
    0;
  const userVote =
    (contribution.votes?.find((v: any) => v.userId === user?.id)?.voteType as
      | "UPVOTE"
      | "DOWNVOTE"
      | null) ?? null;

  const handleDelete = deleteContribution.bind(null, id);

  return (
    <DetailPageCardShell
      backHref="/contributions"
      backLabel="Back to Contributions"
      authorHref={`/scholars/${contribution.author.id}`}
      authorName={contribution.author.name || "Scholar"}
      authorHandle={contribution.author.handle || undefined}
      authorAvatarUrl={contribution.author.avatarUrl || undefined}
      managementControls={
        user?.id === contribution.author.id ? (
          <OwnerActionsDropdown
            editHref={`/contributions/${contribution.id}/edit`}
            onDelete={handleDelete}
            isOwner={true}
            editLabel="Edit Contribution"
            deleteLabel="Delete"
          />
        ) : null
      }
      authorId={contribution.author.id}
      isFollowing={
        (contribution.author as any)?.followers?.length ? true : false
      }
      createdDate={contribution.createdAt}
      editedDate={
        contribution.updatedAt > contribution.createdAt
          ? contribution.updatedAt
          : undefined
      }
      footerVoteButton={
        <VoteButton
          targetId={contribution.id}
          type="contribution"
          initialUpvotes={upvotes}
          initialDownvotes={downvotes}
          initialUserVote={userVote}
        />
      }
      footerCommentsHref={`/contributions/${contribution.id}#comments`}
      footerCommentsCount={contribution._count.comments}
      discussion={
        <div
          className="mt-4 sm:mt-6 p-4 sm:p-6 md:p-8 md:mt-8 sb-surface-strong rounded-xl"
          id="comments"
        >
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-950 mb-3 sm:mb-4 md:mb-6">Discussion</h2>
          <CommentSection
            comments={contribution.comments}
            targetId={contribution.id}
            type="contribution"
            currentUserId={user?.id || null}
            postAuthorId={contribution.author.id}
          />
        </div>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            contribution.status === "APPROVED"
              ? "bg-green-100 text-green-700"
              : contribution.status === "PENDING"
                ? "bg-amber-100 text-amber-700"
                : "bg-red-100 text-red-700"
          }`}
        >
          {contribution.status}
        </span>
        {contribution.amount && (
          <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
            ₹{contribution.amount}
          </span>
        )}
      </div>

      <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-950 mb-1.5 sm:mb-2">
        {contribution.title}
      </h1>

      <RichContent
        content={contribution.message}
        className="text-slate-800 leading-relaxed mb-4 sm:mb-6"
      />

      <div className="rounded-xl border border-blue-100/50 bg-blue-50/50 p-3 sm:p-4 text-xs sm:text-sm">
        <p className="font-semibold text-blue-700 mb-1">
          🙏 Thank you for your support!
        </p>
        <p className="text-slate-600">
          Your contributions help keep ScholarBase running — maintaining the
          server, database, and continuous development for the research
          community.
        </p>
      </div>
    </DetailPageCardShell>
  );
};

export default ContributionDetailPage;
