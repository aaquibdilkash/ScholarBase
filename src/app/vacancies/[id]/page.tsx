import { notFound } from "next/navigation";
import { CommentSection } from "@/components/interactions/CommentSection";
import { createClient } from "@/utils/supabase/server";
import { VoteButton } from "@/components/interactions/VoteButton";
import { BookmarkButton } from "@/components/interactions/BookmarkButton";

import { deleteJobVacancy, getVacancyById } from "@/app/actions/vacancies";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";
import DetailPageCardShell from "@/components/cards/DetailPageCardShell";
import { ReportMenu } from "@/components/cards/ReportMenu";
import { RichContent } from "@/components/content/RichContent";
import { Clock, Building2, BookOpen } from "lucide-react";
import { SmartExternalLink } from "@/components/ui/SmartExternalLink";

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
  const affiliation = [vacancy.department, vacancy.subject]
    .map((part) => part?.trim())
    .filter((part): part is string => !!part)
    .join(" • ");
  const description = affiliation
    ? `${vacancy.title} at ${vacancy.institution} (${affiliation}). Last date to apply: ${new Date(vacancy.deadline).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}.`
    : `${vacancy.title} at ${vacancy.institution}. Last date to apply: ${new Date(vacancy.deadline).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}.`;
  return buildMetadata({
    title: `${vacancy.title} at ${vacancy.institution}`,
    description,
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
    (vacancy.votes?.[0]?.voteType as
      "UPVOTE" | "DOWNVOTE" | null) ?? null;

  return (
    <DetailPageCardShell
      isDeleted={vacancy.isDeleted}
      deletedByType={vacancy.deletedByType}
      deletedNoun="vacancy"
      isFrozen={vacancy.isFrozen ?? false}
      frozenEntityId={vacancy.id}
      frozenModule="JOB_VACANCY"
      frozenEntityType="POST"
      frozenOwnerId={vacancy.author?.id ?? null}
      frozenHasActiveAppeal={vacancy.hasActiveAppeal ?? false}
      backHref="/vacancies"
      backLabel="Back to Academic Vacancies"
      authorHref={`/scholars/${vacancy.author?.id}`}
      authorName={vacancy.author?.name || "Scholar"}
      authorHandle={vacancy.author?.handle || undefined}
      authorAvatarUrl={vacancy.author?.avatarUrl || undefined} authorVerified={!!(vacancy.author?.institutionVerifiedAt)}
      managementControls={
        user?.id === vacancy.author?.id ? (
          <OwnerActionsDropdown
            editHref={`/vacancies/${vacancy.id}/edit`}
            onDelete={async () => {
              "use server";
              const res = await deleteJobVacancy(vacancy.id);
              if (res?.success === false) return res;
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
          isOwnContent={user?.id === vacancy.author?.id}
        />
      }
      footerBookmarkButton={
        <BookmarkButton
          frozen={vacancy.isFrozen === true}
          targetId={vacancy.id}
          module="JOB_VACANCY"
          initialTotalBookmarks={vacancy.totalBookmarks ?? 0}
          initialIsBookmarked={Array.isArray(vacancy.bookmarks) && vacancy.bookmarks.length > 0}
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
          <SmartExternalLink
            url={vacancy.notificationLink}
            className="flex-1 sb-button-soft"
            urlLabel="View Details"
          />
          <SmartExternalLink
            url={vacancy.applyLink}
            className="flex-1 sb-button-primary"
            urlLabel="Apply Now"
            emailLabel="Email to Apply"
          />
        </div>
      }
      discussion={
        <CommentSection
          locked={vacancy.isFrozen ?? false}
          deleted={vacancy.isDeleted}
          comments={vacancy.comments}
          totalComments={vacancy.totalComments}
          targetId={vacancy.id}
          module="vacancy"
          currentUserId={user?.id || null}
          postAuthorId={vacancy.author?.id}
        />
      }
    >
      <h1 className="mb-1.5 sm:mb-2 min-w-0 max-w-full break-words text-lg sm:text-xl md:text-2xl font-bold text-slate-950 [overflow-wrap:anywhere]">
        {vacancy.title}
      </h1>
      <p className="mb-3 sm:mb-4 min-w-0 max-w-full break-words text-sm sm:text-base font-medium text-blue-700 [overflow-wrap:anywhere]">
        {vacancy.institution}
      </p>
      {(vacancy.department || vacancy.subject) && (
        <div className="mb-3 sm:mb-4 flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm text-slate-600">
          {vacancy.department && (
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <Building2 className="h-4 w-4 shrink-0 text-slate-400" />
              <span className="break-words [overflow-wrap:anywhere]">
                {vacancy.department}
              </span>
            </span>
          )}
          {vacancy.subject && (
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <BookOpen className="h-4 w-4 shrink-0 text-slate-400" />
              <span className="break-words font-medium [overflow-wrap:anywhere]">
                {vacancy.subject}
              </span>
            </span>
          )}
        </div>
      )}

      <div className="mb-3 sm:mb-4 flex min-w-0 items-center gap-2 text-xs sm:text-sm text-slate-600">
        <Clock className="h-5 w-5 shrink-0 text-slate-400" />
        <span className="shrink-0">Last Date to Apply:</span>
        <span className="min-w-0 flex-1 break-words font-medium [overflow-wrap:anywhere]">
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
