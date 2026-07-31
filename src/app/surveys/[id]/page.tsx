import { notFound } from "next/navigation";
import Link from "next/link";
import { CommentSection } from "@/components/interactions/CommentSection";
import { RichContent } from "@/components/content/RichContent";
import { createClient } from "@/utils/supabase/server";
import { VoteButton } from "@/components/interactions/VoteButton";
import {
  deleteSurvey,
  getSurvey,
  hasUserResponded,
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

  const hasResponded = user ? await hasUserResponded(id, user.id) : false;
  const response =
    user && hasResponded ? await getSurveyResponse(id, user.id) : null;

  const upvotes =
    survey.votes?.filter((v: any) => v.voteType === "UPVOTE").length ?? 0;
  const downvotes =
    survey.votes?.filter((v: any) => v.voteType === "DOWNVOTE").length ?? 0;
  const userVote =
    (survey.votes?.find((v: any) => v.userId === user?.id)?.voteType as
      | "UPVOTE"
      | "DOWNVOTE"
      | null) ?? null;

  const isOwner = user?.id === survey.author.id;
  const isOpen = survey.status === "OPEN";

  return (
    <DetailPageCardShell
      backHref="/surveys"
      backLabel="Back to Surveys"
      authorHref={`/scholar/${survey.author.id}`}
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
            }}
            isOwner={true}
            editLabel="Edit Survey"
            deleteLabel="Delete"
          />
        ) : null
      }
      authorId={survey.author.id}
      isFollowing={(survey.author as any)?.followers?.length ? true : false}
      createdDate={survey.createdAt}
      editedDate={
        survey.updatedAt > survey.createdAt ? survey.updatedAt : undefined
      }
      footerVoteButton={
        <VoteButton
          targetId={survey.id}
          type="survey"
          initialUpvotes={upvotes}
          initialDownvotes={downvotes}
          initialUserVote={userVote}
        />
      }
      footerCommentsHref={`/surveys/${survey.id}#comments`}
      footerCommentsCount={survey._count.comments}
      discussion={
        <div
          className="mt-4 sm:mt-6 p-4 sm:p-6 md:p-8 md:mt-8 sb-surface-strong rounded-xl"
          id="comments"
        >
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-950 mb-3 sm:mb-4 md:mb-6">
            Discussion
          </h2>
          <CommentSection
            comments={survey.comments}
            targetId={survey.id}
            type="survey"
            currentUserId={user?.id || null}
            postAuthorId={survey.author.id}
          />
        </div>
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
          {survey._count.responses} Response
          {survey._count.responses !== 1 ? "s" : ""}
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
      <div className="mb-4 sm:mb-6 flex flex-col gap-2 rounded-xl border border-slate-100/50 bg-slate-50/50 p-3 sm:p-4 text-xs sm:text-sm font-semibold text-slate-600">
        <div className="flex items-center gap-2">
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
          {survey.questions.length} Question
          {survey.questions.length !== 1 ? "s" : ""}
        </div>
        {survey.shareData && (
          <div className="flex items-center gap-2 text-blue-600">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
              />
            </svg>
            Data sharing is enabled — results are available
          </div>
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
