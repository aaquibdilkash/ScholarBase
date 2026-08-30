import { notFound } from "next/navigation";
import DetailPageCardShell from "@/components/cards/DetailPageCardShell";
import { ReportMenu } from "@/components/cards/ReportMenu";
import { CommentSection } from "@/components/interactions/CommentSection";
import { VoteButton } from "@/components/interactions/VoteButton";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";
import { createClient } from "@/utils/supabase/server";
import { getJournalById } from "../../actions/journals";
import { deleteJournal } from "@/app/actions/journals";
import { RichContent } from "@/components/content/RichContent";

import { buildMetadata } from "@/lib/seo";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const journal = await getJournalById(id).catch(() => null);
  if (!journal) return { title: "Academic Journal" };
  return buildMetadata({
    title: journal.title,
    description: (
      journal.about ||
      `${journal.title}${journal.publisher ? ` by ${journal.publisher}` : ""}${journal.issn ? ` (ISSN ${journal.issn})` : ""}`
    ).replace(/<[^>]*>/g, " "),
    path: `/journals/${journal.id}`,
    type: "article",
    publishedTime: journal.createdAt,
    modifiedTime: journal.updatedAt,
    section: "Journals",
  });
}

const JournalDetailPage = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const journal = await getJournalById(id, user?.id);

  if (!journal) notFound();

  const j = journal;
  const userVote =
    (j.votes?.find((v) => v.userId === user?.id)?.voteType as
      "UPVOTE" | "DOWNVOTE" | null) ?? null;

  async function handleDelete() {
    "use server";
    await deleteJournal(j.id);
    return { redirect: "/journals" };
  }

  return (
    <DetailPageCardShell
      isFrozen={j.isFrozen ?? false}
      backHref="/journals"
      backLabel="Back to Journals"
      authorHref={`/scholars/${j.author?.id}`}
      authorName={j.author?.name || "Scholar"}
      authorHandle={j.author?.handle || undefined}
      authorAvatarUrl={j.author?.avatarUrl || undefined}
      authorId={j.author?.id}
      isFollowing={!!j.author?.followers?.length}
      currentUserId={user?.id}
      createdDate={j.createdAt}
      editedDate={j.updatedAt > j.createdAt ? j.updatedAt : undefined}
      managementControls={
        user?.id === j.author?.id ? (
          <OwnerActionsDropdown
            editHref={`/journals/${j.id}/edit`}
            onDelete={handleDelete}
            isOwner={true}
            editLabel="Edit Journal"
            deleteLabel="Delete"
          />
        ) : null
      }
      footerVoteButton={
        <VoteButton
          targetId={j.id}
          module="JOURNAL"
          initialTotalVotes={j.totalVotes}
          initialUserVote={userVote}
        />
      }
      footerCommentsHref={`/journals/${j.id}#comments`}
      footerCommentsCount={j.totalComments}
      footerReportMenu={
        <ReportMenu
          entityId={j.id}
          entityType="POST"
          module="JOURNAL"
          ownerId={j.author?.id ?? null}
          currentUserId={user?.id ?? null}
          isFrozen={j.isFrozen}
          isDeleted={false}
          hasActiveAppeal={j.hasActiveAppeal}
        />
      }
      discussion={
        <CommentSection
          locked={j.isFrozen ?? false}
          comments={j.comments}
          totalComments={j.totalComments}
          targetId={j.id}
          module="journal"
          currentUserId={user?.id ?? null}
          postAuthorId={j.author?.id}
        />
      }
    >
      <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-950 mb-3 sm:mb-4">
        {j.title}
      </h1>

      <div className="grid grid-cols-2 gap-2 sm:gap-4 mb-4 sm:mb-6">
        {j.publisher && (
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">
              Publisher
            </p>
            <p className="text-sm font-semibold text-slate-800 mt-1">
              {j.publisher}
            </p>
          </div>
        )}
        {j.issn && (
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">
              ISSN
            </p>
            <p className="text-sm font-semibold text-slate-800 mt-1">
              {j.issn}
            </p>
          </div>
        )}
        {j.impactFactor && (
          <div className="rounded-xl bg-amber-50 p-3">
            <p className="text-xs text-amber-500 font-medium uppercase tracking-wider">
              Impact Factor
            </p>
            <p className="text-sm font-semibold text-amber-800 mt-1">
              {j.impactFactor}
            </p>
          </div>
        )}
        {j.scopusQuartile && j.scopusQuartile !== "NONE" && (
          <div className="rounded-xl bg-emerald-50 p-3">
            <p className="text-xs text-emerald-500 font-medium uppercase tracking-wider">
              Scopus Quartile
            </p>
            <p className="text-sm font-semibold text-emerald-800 mt-1">
              {j.scopusQuartile}
            </p>
          </div>
        )}
        {j.abdcRanking && j.abdcRanking !== "NONE" && (
          <div className="rounded-xl bg-purple-50 p-3">
            <p className="text-xs text-purple-500 font-medium uppercase tracking-wider">
              ABDC Ranking
            </p>
            <p className="text-sm font-semibold text-purple-800 mt-1">
              {j.abdcRanking.replace("_STAR", "*")}
            </p>
          </div>
        )}
        {j.wosIndex && j.wosIndex !== "NONE" && (
          <div className="rounded-xl bg-blue-50 p-3">
            <p className="text-xs text-blue-500 font-medium uppercase tracking-wider">
              Web of Science Index
            </p>
            <p className="text-sm font-semibold text-blue-800 mt-1">
              {j.wosIndex}
            </p>
          </div>
        )}
        {j.wosQuartile && j.wosQuartile !== "NONE" && (
          <div className="rounded-xl bg-sky-50 p-3">
            <p className="text-xs text-sky-500 font-medium uppercase tracking-wider">
              Web of Science Quartile
            </p>
            <p className="text-sm font-semibold text-sky-800 mt-1">
              {j.wosQuartile}
            </p>
          </div>
        )}
        {j.sjrQuartile && j.sjrQuartile !== "NONE" && (
          <div className="rounded-xl bg-orange-50 p-3">
            <p className="text-xs text-orange-500 font-medium uppercase tracking-wider">
              SJR Quartile
            </p>
            <p className="text-sm font-semibold text-orange-800 mt-1">
              {j.sjrQuartile}
            </p>
          </div>
        )}
        {j.sjrScore != null && (
          <div className="rounded-xl bg-orange-50 p-3">
            <p className="text-xs text-orange-500 font-medium uppercase tracking-wider">
              SJR Score
            </p>
            <p className="text-sm font-semibold text-orange-800 mt-1">
              {j.sjrScore}
            </p>
          </div>
        )}
        {j.citeScore != null && (
          <div className="rounded-xl bg-teal-50 p-3">
            <p className="text-xs text-teal-500 font-medium uppercase tracking-wider">
              CiteScore
            </p>
            <p className="text-sm font-semibold text-teal-800 mt-1">
              {j.citeScore}
            </p>
          </div>
        )}
      </div>

      {j.about && (
        <div className="mt-4 sm:mt-6">
          <h3 className="text-base sm:text-lg font-semibold text-slate-950 mb-1.5 sm:mb-2">
            About
          </h3>
          <RichContent content={j.about} />
        </div>
      )}

      <div className="flex gap-3 sm:gap-4 mt-2 sm:mt-2">
        {j.website && (
          <a
            href={j.website}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 rounded-lg bg-slate-950 py-2 sm:py-2.5 text-center text-xs sm:text-sm font-semibold text-white transition-colors duration-200 hover:bg-slate-800"
          >
            View Website
          </a>
        )}
      </div>
    </DetailPageCardShell>
  );
};

export default JournalDetailPage;
