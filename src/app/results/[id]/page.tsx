import { notFound } from "next/navigation";
import { CommentSection } from "@/components/interactions/CommentSection";
import { createClient } from "@/utils/supabase/server";
import { VoteButton } from "@/components/interactions/VoteButton";

import { deleteResult, getResult } from "@/app/actions/results";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";
import DetailPageCardShell from "@/components/cards/DetailPageCardShell";
import { Building2, Calendar } from "lucide-react";
import { RichContent } from "@/components/content/RichContent";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const result = await getResult(id).catch(() => null);
  if (!result) return { title: "Result" };
  return buildMetadata({
    title: result.title,
    description: result.description.slice(0, 160),
    path: `/results/${result.id}`,
    type: "article",
  });
}

const ResultDetailPage = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const result = await getResult(id, user?.id);

  if (!result) {
    notFound();
  }

  const TYPE_LABELS: Record<string, string> = {
    ADMISSION: "Admission Result",
    VACANCY: "Vacancy Result",
    EVENT: "Event Result",
    EXAM: "Exam Result",
    OTHER: "Other Result",
  };

  const upvotes =
    result.votes?.filter((v) => v.voteType === "UPVOTE").length ?? 0;
  const downvotes =
    result.votes?.filter((v) => v.voteType === "DOWNVOTE").length ?? 0;
  const userVote =
    (result.votes?.find((v) => v.userId === user?.id)?.voteType as
      | "UPVOTE"
      | "DOWNVOTE"
      | null) ?? null;

  return (
    <DetailPageCardShell
      backHref="/results"
      backLabel="Back to Results"
      authorHref={`/scholars/${result.author.id}`}
      authorName={result.author.name || "Scholar"}
      authorHandle={result.author.handle || undefined}
      authorAvatarUrl={result.author.avatarUrl || undefined}
      managementControls={
        user?.id === result.author.id ? (
          <OwnerActionsDropdown
            editHref={`/results/${result.id}/edit`}
            onDelete={async () => {
              "use server";
              await deleteResult(result.id);
              return { redirect: "/results" };
            }}
            isOwner={true}
            editLabel="Edit Result"
            deleteLabel="Delete"
          />
        ) : null
      }
      authorId={result.author.id}
      isFollowing={(result.author as { followers?: { followerId: string }[] })?.followers?.length ? true : false}
      currentUserId={user?.id}
      createdDate={result.createdAt}
      editedDate={
        result.updatedAt > result.createdAt ? result.updatedAt : undefined
      }
      footerVoteButton={
        <VoteButton
          targetId={result.id}
          type="result"
          initialUpvotes={upvotes}
          initialDownvotes={downvotes}
          initialUserVote={userVote}
        />
      }
      footerCommentsHref={`/results/${result.id}#comments`}
      footerCommentsCount={result._count.comments}
      discussion={
          <CommentSection
            comments={result.comments}
            targetId={result.id}
            type="result"
            currentUserId={user?.id || null}
            postAuthorId={result.author.id}
          />
      }
    >
      <div className="mb-4 flex items-center gap-2">
        <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
          {TYPE_LABELS[result.type] || result.type}
        </span>
        {result.category && (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {result.category}
          </span>
        )}
      </div>

      <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-950 mb-1.5 sm:mb-2">
        {result.title}
      </h1>

      <RichContent
        content={result.description}
        className="text-slate-800 leading-relaxed mb-4 sm:mb-6"
      />

      {(result.conductingBody || result.session) && (
        <div className="mb-4 sm:mb-6 flex flex-col gap-2 rounded-xl border border-slate-100/50 bg-slate-50/50 p-3 sm:p-4 text-xs sm:text-sm font-semibold text-slate-600">
          {result.conductingBody && (
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Conducting Body: {result.conductingBody}
            </div>
          )}
          {result.session && (
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Session: {result.session}
            </div>
          )}
        </div>
      )}

      <div className="flex gap-3 sm:gap-4 mb-6 sm:mb-8">
        {result.notificationLink && (
          <a
            href={result.notificationLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 sb-button-soft"
          >
            View Notification
          </a>
        )}
        {result.resultLink && (
          <a
            href={result.resultLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 sb-button-primary"
          >
            Check Results
          </a>
        )}
      </div>
    </DetailPageCardShell>
  );
};

export default ResultDetailPage;
