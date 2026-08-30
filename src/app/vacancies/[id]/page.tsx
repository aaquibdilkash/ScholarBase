"use client";

import { Clock } from "lucide-react";
import { notFound, useRouter } from "next/navigation";
import { CommentSection } from "@/components/interactions/CommentSection";
import type { CommentWithAuthorAndVotes } from "@/types/comments";
import { VoteButton } from "@/components/interactions/VoteButton";
import { deleteJobVacancy, getVacancyById } from "@/app/actions/vacancies";
import DetailPageCardShell from "@/components/cards/DetailPageCardShell";
import { ReportMenu } from "@/components/cards/ReportMenu";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";
import { RichContent } from "@/components/content/RichContent";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@/hooks/useUser";
import { useToast } from "@/components/ui/Toast";

const VacancyDetailPage = ({ params }: { params: { id: string } }) => {
  const { id } = params;
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useUser();
  const { toast } = useToast();

  const {
    data: vacancy,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["vacancy", id],
    queryFn: () => getVacancyById(id),
  });

  const { mutate: deleteVacancy } = useMutation({
    mutationFn: deleteJobVacancy,
    onSuccess: () => {
      toast("Vacancy deleted successfully", "success");
      queryClient.invalidateQueries({ queryKey: ["vacancies"] });
      router.push("/vacancies");
    },
    onError: (error) => {
      toast(error.message, "error");
    },
  });

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 md:p-8">
        <div className="w-full max-w-4xl mx-auto">
          <div className="sb-surface-strong rounded-lg p-6 animate-pulse">
            <div className="h-8 bg-slate-200 rounded w-3/4 mb-4"></div>
            <div className="h-6 bg-slate-200 rounded w-1/2 mb-6"></div>
            <div className="space-y-3">
              <div className="h-4 bg-slate-200 rounded"></div>
              <div className="h-4 bg-slate-200 rounded"></div>
              <div className="h-4 bg-slate-200 rounded w-5/6"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isError || !vacancy) {
    notFound();
  }

  const userVote =
    (vacancy.votes?.find((v) => v.userId === user?.id)?.voteType as
      "UPVOTE" | "DOWNVOTE" | null) ?? null;

  function handleDelete() {
    deleteVacancy(vacancy!.id);
    return { refresh: false };
  }

  return (
    <DetailPageCardShell
      isFrozen={vacancy.isFrozen ?? false}
      backHref="/vacancies"
      backLabel="Back to Academic Vacancies"
      authorHref={`/scholars/${vacancy.author?.id}`}
      authorName={vacancy.author?.name || "Scholar"}
      authorHandle={vacancy.author?.handle || undefined}
      authorAvatarUrl={vacancy.author?.avatarUrl || undefined}
      authorId={vacancy.author?.id}
      isFollowing={
        (vacancy.author as { followers?: { followerId: string }[] })?.followers
          ?.length
          ? true
          : false
      }
      currentUserId={user?.id}
      createdDate={vacancy.createdAt}
      managementControls={
        user?.id === vacancy.author?.id ? (
          <OwnerActionsDropdown
            editHref={`/vacancies/${vacancy.id}/edit`}
            onDelete={handleDelete}
            isOwner={true}
            editLabel="Edit Vacancy"
            deleteLabel="Delete"
          />
        ) : null
      }
      footerVoteButton={
        <VoteButton
          targetId={vacancy.id}
          module="JOB_VACANCY"
          initialTotalVotes={vacancy.totalVotes}
          initialUserVote={userVote}
        />
      }
      footerCommentsHref={`/vacancies/${vacancy.id}#comments`}
      footerCommentsCount={vacancy.totalComments}
      footerReportMenu={
        <ReportMenu
          entityId={vacancy.id}
          entityType="POST"
          module="JOB_VACANCY"
          ownerId={vacancy.author?.id ?? null}
          currentUserId={user?.id ?? null}
          isFrozen={vacancy.isFrozen}
          isDeleted={false}
          hasActiveAppeal={vacancy.hasActiveAppeal}
        />
      }
      bodyBottomContent={
        <div className="flex gap-3 sm:gap-4 mt-3 sm:mt-4">
          {vacancy.notificationLink && (
            <a
              href={vacancy.notificationLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 sb-button-soft"
            >
              View Details
            </a>
          )}
          {vacancy.applyLink && (
            <a
              href={vacancy.applyLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 sb-button-primary"
            >
              Apply Now
            </a>
          )}
        </div>
      }
      discussion={
        <CommentSection
          locked={vacancy.isFrozen ?? false}
          comments={vacancy.comments as CommentWithAuthorAndVotes[]}
          totalComments={vacancy.totalComments}
          targetId={vacancy.id}
          module="vacancy"
          currentUserId={user?.id || null}
          postAuthorId={vacancy.author?.id}
        />
      }
    >
      <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-950 mb-1.5 sm:mb-2">
        {vacancy.title}
      </h1>
      <p className="text-sm sm:text-base font-medium text-slate-600 mb-3 sm:mb-4">
        {vacancy.institution}
      </p>

      <div className="mb-3 sm:mb-4 flex items-center gap-2 text-xs sm:text-sm text-slate-600">
        <Clock className="h-5 w-5 shrink-0 text-slate-400" />
        <span>Last Date to Apply:</span>
        <span className="font-medium">
          {new Date(vacancy.deadline).toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </span>
      </div>
      <RichContent
        content={vacancy.description}
        className="text-slate-800 leading-relaxed"
      />
    </DetailPageCardShell>
  );
};

export default VacancyDetailPage;
