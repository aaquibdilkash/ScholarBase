import { ClipboardList, Share2 } from "lucide-react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CommentSection } from "@/components/interactions/CommentSection";
import { RichContent } from "@/components/content/RichContent";
import { createClient } from "@/utils/supabase/server";
import { VoteButton } from "@/components/interactions/VoteButton";
import {
  deleteSurvey,
  getSurvey,
  closeSurvey,
  reopenSurvey,
  toggleShareData,
  getSurveyResponse,
} from "@/app/actions/surveys";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";
import DetailPageCardShell from "@/components/cards/DetailPageCardShell";
import { SurveyResponseForm } from "@/components/surveys/SurveyResponseForm";

const PRIVACY_LABELS: Record<string, string> = {
  ANONYMOUS: "Anonymous",
  NON_ANONYMOUS: "Non-anonymous",
  HYBRID: "Hybrid",
};

import { buildMetadata } from "@/lib/seo";
import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const survey = await getSurvey(id).catch(() => null);
  if (!survey) return { title: "Research Survey" };
  return buildMetadata({
    title: survey.title,
    description: survey.description || `Research survey: ${survey.title}.`,
    path: `/surveys/${survey.id}`,
    type: "article",
    publishedTime: survey.createdAt,
    modifiedTime: survey.updatedAt,
    section: "Research Surveys",
  });
}

const SurveyDetailPage = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const survey = await getSurvey(id, user?.id);

  if (!survey) {
    notFound();
  }

  const response = user ? await getSurveyResponse(id, user.id) : null;
  const hasResponded = !!response;

  const userVote =
    (survey.votes?.find((v) => v.userId === user?.id)?.voteType as
      | "UPVOTE"
      | "DOWNVOTE"
      | null) ?? null;

  const isOwner = user?.id === survey.author.id;
  const isOpen = survey.status === "OPEN";

  return (
    <DetailPageCardShell
      backHref="/surveys"
      backLabel="Back to Surveys"
      authorHref={`/scholars/${survey.author.id}`}
      authorName={survey.author.name || "Scholar"}
      authorHandle={survey.author.handle || undefined}
      authorAvatarUrl={survey.author.avatarUrl || undefined}
      managementControls={
        isOwner ? (
          <OwnerActionsDropdown
            editHref={`/surveys/${survey.id}/edit`}
            onDelete={async () => {
              "use server";
              await deleteSurvey(survey.id);
              return { redirect: "/surveys" };
            }}
            isOwner={true}
            editLabel="Edit Survey"
            deleteLabel="Delete"
          />
        ) : null
      }
      authorId={survey.author.id}
      isFollowing={
        (survey.author as { followers?: { followerId: string }[] })?.followers
          ?.length
          ? true
          : false
      }
      currentUserId={user?.id}
      createdDate={survey.createdAt}
      editedDate={
        survey.updatedAt > survey.createdAt ? survey.updatedAt : undefined
      }
      footerVoteButton={
        <VoteButton
          targetId={survey.id}
          module="RESEARCH_SURVEY"
          initialTotalVotes={survey.totalVotes}
          initialUserVote={userVote}
        />
      }
      footerCommentsHref={`/surveys/${survey.id}#comments`}
      footerCommentsCount={survey.totalComments}
      discussion={
        <CommentSection
          comments={survey.comments}
          targetId={survey.id}
          module="survey"
          currentUserId={user?.id || null}
          postAuthorId={survey.author.id}
        />
      }
    >
      <div className="mb-4 flex items-center gap-2">
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            isOpen ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
          }`}
        >
          {isOpen ? "Open" : "Closed"}
        </span>
        <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
          {PRIVACY_LABELS[survey.privacy] || survey.privacy}
        </span>
        <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-700">
          {survey.totalResponses} Response
          {survey.totalResponses !== 1 ? "s" : ""}
        </span>
      </div>

      <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-950 mb-1.5 sm:mb-2">
        {survey.title}
      </h1>

      {survey.description && (
        <RichContent
          content={survey.description}
          className="text-slate-800 leading-relaxed mb-4 sm:mb-6"
        />
      )}

      {/* Survey questions count & overview */}
      <div className="mb-4 sm:mb-6 flex flex-col gap-2 rounded-xl border border-slate-100/50 bg-slate-50/50 p-3 sm:p-4 text-xs sm:text-sm font-semibold text-slate-600 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5" />
          {survey.questions.length} Question
          {survey.questions.length !== 1 ? "s" : ""}
        </div>
        {survey.shareData && (
          <Link
            href={`/surveys/${survey.id}/results`}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-800 transition-colors dark:text-blue-400 dark:hover:text-blue-200"
          >
            <Share2 className="w-5 h-5" />
            <span className="font-medium">
              Data sharing is enabled — results are available
            </span>
          </Link>
        )}
      </div>

      {/* Owner actions */}
      {isOwner && (
        <div className="flex gap-2 sm:gap-3 mb-6 sm:mb-8 flex-wrap">
          {isOpen ? (
            <form
              action={async () => {
                "use server";
                await closeSurvey(survey.id);
              }}
            >
              <button
                type="submit"
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 transition"
              >
                Close Survey
              </button>
            </form>
          ) : (
            <form
              action={async () => {
                "use server";
                await reopenSurvey(survey.id);
              }}
            >
              <button
                type="submit"
                className="rounded-xl border border-green-200 bg-green-50 px-4 py-2 text-sm font-semibold text-green-700 hover:bg-green-100 transition"
              >
                Reopen Survey
              </button>
            </form>
          )}

          {survey.shareData || !isOpen ? (
            <Link
              href={`/surveys/${survey.id}/results`}
              className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 transition"
            >
              View Results
            </Link>
          ) : (
            <form
              action={async () => {
                "use server";
                await toggleShareData(survey.id);
              }}
            >
              <button
                type="submit"
                className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-100 transition"
              >
                Enable Data Sharing & View Results
              </button>
            </form>
          )}
        </div>
      )}

      {/* Survey Response Form */}
      {isOpen && (
        <div className="mt-8 border-t border-slate-200 pt-8">
          <h2 className="text-xl font-bold text-slate-950 mb-6">
            {hasResponded ? "Update Your Response" : "Fill Out This Survey"}
          </h2>
          <SurveyResponseForm
            key={response?.id ?? "no-response"}
            surveyId={survey.id}
            questions={survey.questions}
            privacy={survey.privacy}
            hasResponded={hasResponded}
            response={response}
          />
        </div>
      )}

      {!isOpen && (
        <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center">
          <p className="text-slate-500 font-medium">
            This survey is closed for responses.
          </p>
          {survey.shareData && (
            <Link
              href={`/surveys/${survey.id}/results`}
              className="mt-2 inline-block text-sm font-semibold text-blue-600 hover:text-blue-800"
            >
              View Results →
            </Link>
          )}
        </div>
      )}
    </DetailPageCardShell>
  );
};

export default SurveyDetailPage;
