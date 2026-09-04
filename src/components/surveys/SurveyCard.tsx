"use client";

import { useQueryClient } from "@tanstack/react-query";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";
import ListPageCardShell from "@/components/cards/ListPageCardShell";
import { ReportMenu } from "@/components/cards/ReportMenu";
import { VoteButton } from "@/components/interactions/VoteButton";
import { RichContent } from "@/components/content/RichContent";
import { deleteSurvey } from "@/app/actions/surveys";
import { useToast } from "@/components/ui/Toast";
import Link from "next/link";
import { BarChart2 } from "lucide-react";
import type { SurveyWithAuthor } from "@/types/cards";

const PRIVACY_LABELS: Record<string, string> = {
  ANONYMOUS: "Anonymous",
  NON_ANONYMOUS: "Non-Anonymous",
  HYBRID: "Hybrid",
};

const STATUS_BADGES: Record<string, string> = {
  OPEN: "bg-green-100 text-green-700",
  CLOSED: "bg-red-100 text-red-700",
};

export function SurveyCard({
  survey,
  currentUserId,
}: {
  survey: SurveyWithAuthor;
  currentUserId?: string;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isOwner = currentUserId === survey.authorId;
  const isFollowing = (survey.author?.followers?.length ?? 0) > 0;
  const userVote = (survey.votes || [])[0]?.voteType ?? null;

  return (
    <ListPageCardShell
      authorHref={`/scholars/${survey.author?.id}`}
      authorName={survey.author?.name || "Scholar"}
      authorId={survey.authorId}
      isFollowing={isFollowing}
      currentUserId={currentUserId}
      authorHandle={survey.author?.handle || undefined}
      authorAvatarUrl={survey.author?.avatarUrl || undefined}
      detailPageHref={`/surveys/${survey.id}`}
      noBodyLink={true}
      managementControls={
        isOwner && (
          <OwnerActionsDropdown
            editHref={`/surveys/${survey.id}/edit`}
            isOwner={true}
            onDelete={async () => {
              try {
                const response = await deleteSurvey(survey.id);
                if (!response?.success || !response.data) {
                  toast("Failed to delete survey.", "error");
                  return { refresh: false };
                }
                queryClient.setQueriesData(
                  { queryKey: ["surveys"] },
                  (oldData: SurveyWithAuthor[] = []) =>
                    oldData.filter((s) => s.id !== response.data.deletedId),
                );
                toast("Survey deleted successfully.", "success");
                return { refresh: false };
              } catch (error) {
                const message = error instanceof Error ? error.message : "Unknown error";
                toast(message, "error");
                return { refresh: false };
              }
            }}
            editLabel="Edit Survey"
            deleteLabel="Delete"
          />
        )
      }
      createdDate={survey.createdAt}
      editedDate={
        survey.editedAt && survey.editedAt > survey.createdAt ? survey.editedAt : undefined
      }
      footerVoteButton={
        <VoteButton
          frozen={survey.isFrozen === true}
          targetId={survey.id}
          module="RESEARCH_SURVEY"
          initialTotalVotes={survey.totalVotes}
          initialUserVote={userVote}
        />
      }
      footerCommentsHref={`/surveys/${survey.id}`}
      footerCommentsCount={survey.totalComments}
      footerReportMenu={
        <ReportMenu entityId={survey.id} entityType="POST" module="RESEARCH_SURVEY" />
      }
    >
      <Link href={`/surveys/${survey.id}`} className="block group">
        <div className="mb-2 flex items-center gap-2">
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              STATUS_BADGES[survey.status] || "bg-slate-100 text-slate-600"
            }`}
          >
            {survey.status}
          </span>
          <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-700">
            {PRIVACY_LABELS[survey.privacy] || survey.privacy}
          </span>
          <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
            {survey.totalResponses} response
            {survey.totalResponses !== 1 ? "s" : ""}
          </span>
        </div>

        <h2 className="mb-2 break-words break-all text-lg font-semibold leading-tight text-slate-950">
          {survey.title}
        </h2>

        {survey.description && (
          <RichContent
            content={survey.description}
            className="text-sm leading-relaxed text-slate-600 line-clamp-3"
          />
        )}
      </Link>
      {survey.shareData && (
        <Link
          href={`/surveys/${survey.id}/results`}
          className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline"
        >
          <BarChart2 className="w-4 h-4" />
          Data available for sharing — view results
        </Link>
      )}
    </ListPageCardShell>
  );
}
