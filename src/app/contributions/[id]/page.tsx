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
import { RejectionReason } from "@/components/contributions/RejectionReason";

import { buildMetadata } from "@/lib/seo";
import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const contribution = await getContribution(id).catch(() => null);
  if (!contribution) return { title: "Contribution" };
  return buildMetadata({
    title: contribution.title || "ScholarBase Contribution",
    description: (contribution.message || "").replace(/<[^>]*>/g, " ") || "A community contribution supporting ScholarBase.",
    path: `/contributions/${contribution.id}`,
    type: "article",
    publishedTime: contribution.createdAt,
    modifiedTime: contribution.updatedAt,
    section: "Contributions",
  });
}

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

  const userVote =
    (contribution.votes?.find((v) => v.userId === user?.id)?.voteType as
      | "UPVOTE"
      | "DOWNVOTE"
      | null) ?? null;

    const handleDelete = async () => {
    "use server";
    await deleteContribution(id);
    return { redirect: "/contributions" };
  };

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
        (contribution.author as { followers?: { followerId: string }[] })
          ?.followers?.length
          ? true
          : false
      }
      currentUserId={user?.id}
      createdDate={contribution.createdAt}
      editedDate={
        contribution.updatedAt > contribution.createdAt
          ? contribution.updatedAt
          : undefined
      }
      footerVoteButton={
        <VoteButton
          targetId={contribution.id}
          module="CONTRIBUTION"
          initialTotalVotes={contribution.totalVotes}
          initialUserVote={userVote}
        />
      }
      footerCommentsHref={`/contributions/${contribution.id}#comments`}
      footerCommentsCount={contribution.totalComments}
      discussion={
        <CommentSection
          comments={contribution.comments}
          totalComments={contribution.totalComments}
          targetId={contribution.id}
          module="contribution"
          currentUserId={user?.id || null}
          postAuthorId={contribution.author.id}
        />
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

      {contribution.status === "REJECTED" && contribution.rejectionReason && (
        <RejectionReason reason={contribution.rejectionReason} />
      )}

      <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-950 mb-1.5 sm:mb-2">
        {contribution.title}
      </h1>

      <RichContent
        content={contribution.message}
        className="text-slate-800 leading-relaxed mb-4 sm:mb-6"
      />

      <div className="rounded-xl border border-blue-100/50 bg-blue-50/50 p-3 sm:p-4 text-xs sm:text-sm dark:border-blue-500/20 dark:bg-blue-500/10">
        <p className="font-semibold text-blue-700 mb-1 dark:text-blue-300">
          🚀 Empowering Research Through Your Support
        </p>
        <p className="text-slate-600 dark:text-slate-400">
          Your invaluable contributions directly fuel ScholarBase&apos;s
          operations, supporting critical server and database infrastructure,
          and enabling continuous development for the global research community.
        </p>
      </div>
    </DetailPageCardShell>
  );
};

export default ContributionDetailPage;
