import { notFound } from "next/navigation";
import { CommentSection } from "@/components/interactions/CommentSection";
import { createClient } from "@/utils/supabase/server";
import { VoteButton } from "@/components/interactions/VoteButton";
import { BookmarkButton } from "@/components/interactions/BookmarkButton";

import { deleteAcademicPosition, getAcademicPositionById } from "@/app/actions/academic-positions";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";
import DetailPageCardShell from "@/components/cards/DetailPageCardShell";
import { ReportMenu } from "@/components/cards/ReportMenu";
import { RichContent } from "@/components/content/RichContent";
import { Clock, Building2, BookOpen, MapPin, Banknote, CalendarClock } from "lucide-react";
import { SmartExternalLink } from "@/components/ui/SmartExternalLink";

import { buildMetadata, buildNoindexMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import RelatedContent from "@/components/content/RelatedContent";
import { getRelatedContent } from "@/lib/semantic/related";
import { getModeratorDeletedContent } from "@/lib/deleted-content";
import { RemovedContentNotice } from "@/components/moderation/RemovedContentNotice";
import { getPositionTypeLabel, getEmploymentTypeLabel } from "@/lib/academic-positions";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const academicPosition = await getAcademicPositionById(id).catch(() => null);
  if (!academicPosition) return buildNoindexMetadata("Removed content");
  const affiliation = [academicPosition.department, academicPosition.subject]
    .map((part) => part?.trim())
    .filter((part): part is string => !!part)
    .join(" • ");
  const description = affiliation
    ? `${academicPosition.title} at ${academicPosition.institution} (${affiliation}). Last date to apply: ${new Date(academicPosition.deadline).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}.`
    : `${academicPosition.title} at ${academicPosition.institution}. Last date to apply: ${new Date(academicPosition.deadline).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}.`;
  return buildMetadata({
    title: `${academicPosition.title} at ${academicPosition.institution}`,
    description,
    path: `/academic-positions/${academicPosition.id}`,
    type: "article",
    publishedTime: academicPosition.createdAt,
    section: "Academic Positions",
  });
}

const AcademicPositionDetailPage = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const academicPosition = await getAcademicPositionById(id, user?.id);

  if (!academicPosition) {
    const removed = await getModeratorDeletedContent("academicPosition", { id });
    if (!removed) notFound();
    return (
      <RemovedContentNotice
        backHref="/academic-positions"
        backLabel="Back to Academic Positions"
        entityId={removed.id}
        module="ACADEMIC_POSITION"
        ownerId={removed.authorId}
        currentUserId={user?.id}
        hasActiveAppeal={removed.hasActiveAppeal}
        noun="position"
      />
    );
  }

  const userVote =
    (academicPosition.votes?.[0]?.voteType as
      "UPVOTE" | "DOWNVOTE" | null) ?? null;

  const related = await getRelatedContent("ACADEMIC_POSITION", academicPosition.id);

  return (
    <DetailPageCardShell
      relatedContent={
        <RelatedContent title="Related academic positions" items={related} />
      }
      isFrozen={academicPosition.isFrozen ?? false}
      frozenEntityId={academicPosition.id}
      frozenModule="ACADEMIC_POSITION"
      frozenEntityType="POST"
      frozenOwnerId={academicPosition.author?.id ?? null}
      frozenHasActiveAppeal={academicPosition.hasActiveAppeal ?? false}
      backHref="/academic-positions"
      backLabel="Back to Academic Positions"
      authorHref={`/scholars/${academicPosition.author?.id}`}
      authorName={academicPosition.author?.name || "Scholar"}
      authorHandle={academicPosition.author?.handle || undefined}
      authorAvatarUrl={academicPosition.author?.avatarUrl || undefined} authorVerified={!!(academicPosition.author?.institutionVerifiedAt)}
      managementControls={
        user?.id === academicPosition.author?.id ? (
          <OwnerActionsDropdown
            editHref={`/academic-positions/${academicPosition.id}/edit`}
            onDelete={async () => {
              "use server";
              const res = await deleteAcademicPosition(academicPosition.id);
              if (res?.success === false) return res;
              return { redirect: "/academic-positions", invalidateQueries: [["academicPositions"]] };
            }}
            isOwner={true}
            editLabel="Edit Position"
            deleteLabel="Delete"
          />
        ) : null
      }
      authorId={academicPosition.author?.id}
      isFollowing={
        (academicPosition.author as { followers?: { followerId: string }[] })?.followers
          ?.length
          ? true
          : false
      }
      currentUserId={user?.id}
      createdDate={academicPosition.createdAt}
      editedDate={academicPosition.editedAt ?? undefined}
      footerVoteButton={
        <VoteButton
          targetId={academicPosition.id}
          module="ACADEMIC_POSITION"
          initialTotalVotes={academicPosition.totalVotes}
          initialUserVote={userVote}
          isOwnContent={user?.id === academicPosition.author?.id}
        />
      }
      footerBookmarkButton={
        <BookmarkButton
          frozen={academicPosition.isFrozen === true}
          targetId={academicPosition.id}
          module="ACADEMIC_POSITION"
          initialTotalBookmarks={academicPosition.totalBookmarks ?? 0}
          initialIsBookmarked={Array.isArray(academicPosition.bookmarks) && academicPosition.bookmarks.length > 0}
        />
      }
      footerCommentsHref={`/academic-positions/${academicPosition.id}#comments`}
      footerCommentsCount={academicPosition.totalComments}
      footerReportMenu={
        <ReportMenu
          entityId={academicPosition.id}
          entityType="POST"
          module="ACADEMIC_POSITION"
          ownerId={academicPosition.author?.id ?? null}
          currentUserId={user?.id ?? null}
          isFrozen={academicPosition.isFrozen}
          hasActiveAppeal={academicPosition.hasActiveAppeal}
        />
      }
      bodyBottomContent={
        <div className="flex gap-3 sm:gap-4 mt-3 sm:mt-4">
          <SmartExternalLink
            url={academicPosition.notificationLink}
            className="flex-1 sb-button-soft"
            urlLabel="View Details"
          />
          <SmartExternalLink
            url={academicPosition.applyLink}
            className="flex-1 sb-button-primary"
            urlLabel="Apply Now"
            emailLabel="Email to Apply"
          />
        </div>
      }
      discussion={
        <CommentSection
          locked={academicPosition.isFrozen ?? false}
          comments={academicPosition.comments}
          totalComments={academicPosition.totalComments}
          targetId={academicPosition.id}
          module="academicPosition"
          currentUserId={user?.id || null}
          postAuthorId={academicPosition.author?.id}
        />
      }
    >
      <h1 className="mb-1.5 sm:mb-2 min-w-0 max-w-full break-words text-lg sm:text-xl md:text-2xl font-bold text-slate-950 [overflow-wrap:anywhere]">
        {academicPosition.title}
      </h1>
      <p className="mb-2 min-w-0 max-w-full break-words text-sm sm:text-base font-medium text-slate-600 [overflow-wrap:anywhere]">
        {academicPosition.institution}
      </p>
      <div className="mb-3 sm:mb-4 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
          {getPositionTypeLabel(academicPosition.positionType)}
        </span>
        <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {getEmploymentTypeLabel(academicPosition.employmentType)}
        </span>
        {(academicPosition.location || academicPosition.isRemote) && (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            <MapPin className="h-3 w-3" />
            {academicPosition.isRemote
              ? academicPosition.location
                ? `Remote — ${academicPosition.location}`
                : "Remote"
              : academicPosition.location}
          </span>
        )}
      </div>
      {(academicPosition.department || academicPosition.subject) && (
        <div className="mb-3 sm:mb-4 flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm text-slate-600">
          {academicPosition.department && (
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <Building2 className="h-4 w-4 shrink-0 text-slate-400" />
              <span className="break-words [overflow-wrap:anywhere]">
                {academicPosition.department}
              </span>
            </span>
          )}
          {academicPosition.subject && (
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <BookOpen className="h-4 w-4 shrink-0 text-slate-400" />
              <span className="break-words font-medium [overflow-wrap:anywhere]">
                {academicPosition.subject}
              </span>
            </span>
          )}
        </div>
      )}

      {(academicPosition.salaryOrStipend || academicPosition.contractDuration || academicPosition.startDate) && (
        <div className="mb-3 sm:mb-4 flex flex-wrap gap-x-5 gap-y-1 text-xs sm:text-sm text-slate-600">
          {academicPosition.salaryOrStipend && (
            <span className="inline-flex items-center gap-1.5">
              <Banknote className="h-4 w-4 shrink-0 text-slate-400" />
              {academicPosition.salaryOrStipend}
            </span>
          )}
          {academicPosition.contractDuration && (
            <span className="inline-flex items-center gap-1.5">
              <CalendarClock className="h-4 w-4 shrink-0 text-slate-400" />
              {academicPosition.contractDuration}
            </span>
          )}
          {academicPosition.startDate && (
            <span className="inline-flex items-center gap-1.5">
              Starts {new Date(academicPosition.startDate).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          )}
        </div>
      )}

      <div className="mb-3 sm:mb-4 flex min-w-0 items-center gap-2 text-xs sm:text-sm text-slate-600">
        <Clock className="h-5 w-5 shrink-0 text-slate-400" />
        <span className="shrink-0">Last Date to Apply:</span>
        <span className="min-w-0 flex-1 break-words font-medium [overflow-wrap:anywhere]">
          {new Date(academicPosition.deadline).toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </span>
      </div>
      <RichContent
        content={academicPosition.description}
        className="text-slate-800 leading-relaxed"
      />
    </DetailPageCardShell>
  );
};

export default AcademicPositionDetailPage;
