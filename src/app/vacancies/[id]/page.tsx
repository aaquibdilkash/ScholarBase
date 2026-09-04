import { notFound } from "next/navigation";
import { CommentSection } from "@/components/interactions/CommentSection";
import { createClient } from "@/utils/supabase/server";
import { VoteButton } from "@/components/interactions/VoteButton";

import { deleteJobVacancy, getVacancyById } from "@/app/actions/vacancies";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";
import DetailPageCardShell from "@/components/cards/DetailPageCardShell";
import { ReportMenu } from "@/components/cards/ReportMenu";
import { RichContent } from "@/components/content/RichContent";
import { Clock } from "lucide-react";

import { buildMetadata } from "@/lib/seo";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const vacancy = await getVacancyById(id).catch(() => null);
  if (!vacancy) return { title: "Academic Vacancy" };
  return buildMetadata({
    title: `${vacancy.title} at ${vacancy.institution}`,
    description: `${vacancy.title} at ${vacancy.institution}. Last date to apply: ${new Date(vacancy.deadline).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}.`,
    path: `/vacancies/${vacancy.id}`,
    type: "article",
    publishedTime: vacancy.createdAt,
    section: "Academic Vacancies",
  });
}

const VacancyDetailPage = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const vacancy = await getVacancyById(id, user?.id);

  if (!vacancy) {
    notFound();
  }

  const userVote =
    (vacancy.votes?.find((v) => v.userId === user?.id)?.voteType as
      "UPVOTE" | "DOWNVOTE" | null) ?? null;

  return (
    <DetailPageCardShell
      isFrozen={vacancy.isFrozen ?? false}
      backHref="/vacancies"
      backLabel="Back to Academic Vacancies"
      authorHref={`/scholars/${vacancy.author?.id}`}
      authorName={vacancy.author?.name || "Scholar"}
      authorHandle={vacancy.author?.handle || undefined}
      authorAvatarUrl={vacancy.author?.avatarUrl || undefined}
      managementControls={
        user?.id === vacancy.author?.id ? (
          <OwnerActionsDropdown
            editHref={`/vacancies/${vacancy.id}/edit`}
            onDelete={async () => {
              "use server";
              await deleteJobVacancy(vacancy.id);
              return {
                redirect: "/vacancies",
                invalidateQueries: [["vacancies"]],
              };
            }}
            isOwner={true}
            editLabel="Edit Vacancy"
            deleteLabel="Delete"
          />
        ) : null
      }
      authorId={vacancy.author?.id}
      isFollowing={
        (vacancy.author as { followers?: { followerId: string }[] })?.followers
          ?.length
          ? true
          : false
      }
      currentUserId={user?.id}
      createdDate={vacancy.createdAt}
      editedDate={vacancy.editedAt ?? undefined}
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
          comments={vacancy.comments}
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
      <p className="text-sm sm:text-base font-medium text-blue-700 mb-3 sm:mb-4">
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
