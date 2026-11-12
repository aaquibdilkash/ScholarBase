import { notFound } from "next/navigation";
import { CommentSection } from "@/components/interactions/CommentSection";
import { createClient } from "@/utils/supabase/server";
import { VoteButton } from "@/components/interactions/VoteButton";
import { BookmarkButton } from "@/components/interactions/BookmarkButton";

import { deleteCallForPaper, getEvent } from "@/app/actions/call-for-papers";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";
import DetailPageCardShell from "@/components/cards/DetailPageCardShell";
import { ReportMenu } from "@/components/cards/ReportMenu";
import { RichContent } from "@/components/content/RichContent";
import { FeedImage } from "@/components/feed/FeedImage";
import { isValidImageUrl } from "@/lib/image-constants";
import { BookOpen, Building2, Calendar, Clock, MapPin } from "lucide-react";
import { SmartExternalLink } from "@/components/ui/SmartExternalLink";

import { buildMetadata, buildNoindexMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import RelatedContent from "@/components/content/RelatedContent";
import { getRelatedContent } from "@/lib/semantic/related";
import { getModeratorDeletedContent } from "@/lib/deleted-content";
import { RemovedContentNotice } from "@/components/moderation/RemovedContentNotice";
import { getCallForPaperCategoryLabel } from "@/lib/call-for-papers";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const event = await getEvent(id).catch(() => null);
  if (!event) {
    return buildNoindexMetadata("Removed content");
  }
  const location = event.location ? ` at ${event.location}` : "";
  const dateText = event.eventDate
    ? new Date(event.eventDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : "Date to be announced";
  return buildMetadata({
    title: event.title,
    description: `Call for papers${location}. ${dateText}.`,
    path: `/call-for-papers/${event.id}`,
    type: "article",
    publishedTime: event.createdAt,
    section: "Call for Papers",
  });
}

const EventDetailPage = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const event = await getEvent(id, user?.id);

  if (!event) {
    const removed = await getModeratorDeletedContent("callForPaper", { id });
    if (!removed) notFound();
    return (
      <RemovedContentNotice
        backHref="/call-for-papers"
        backLabel="Back to Call for Papers"
        entityId={removed.id}
        module="CALL_FOR_PAPER"
        ownerId={removed.authorId}
        currentUserId={user?.id}
        hasActiveAppeal={removed.hasActiveAppeal}
        noun="event"
      />
    );
  }

  const userVote =
    (event.votes?.[0]?.voteType as "UPVOTE" | "DOWNVOTE" | null) ?? null;

  const related = await getRelatedContent("CALL_FOR_PAPER", event.id);

  return (
    <DetailPageCardShell
      relatedContent={<RelatedContent title="Related events" items={related} />}
      isFrozen={event.isFrozen ?? false}
      frozenEntityId={event.id}
      frozenModule="CALL_FOR_PAPER"
      frozenEntityType="POST"
      frozenOwnerId={event.author?.id ?? null}
      frozenHasActiveAppeal={event.hasActiveAppeal ?? false}
      backHref="/call-for-papers"
      backLabel="Back to Call for Papers"
      authorHref={`/scholars/${event.author?.id}`}
      authorName={event.author?.name || "Scholar"}
      authorHandle={event.author?.handle || undefined}
      authorAvatarUrl={event.author?.avatarUrl || undefined}
      authorVerified={!!event.author?.institutionVerifiedAt}
      managementControls={
        user?.id === event.author?.id ? (
          <OwnerActionsDropdown
            editHref={`/call-for-papers/${event.id}/edit`}
            onDelete={async () => {
              "use server";
              const res = await deleteCallForPaper(event.id);
              if (res?.success === false) return res;
              return { redirect: "/call-for-papers", invalidateQueries: [["call-for-papers"]] };
            }}
            isOwner={true}
            editLabel="Edit Call for Papers"
            deleteLabel="Delete"
          />
        ) : null
      }
      authorId={event.author?.id}
      isFollowing={
        (event.author as { followers?: { followerId: string }[] })?.followers
          ?.length
          ? true
          : false
      }
      currentUserId={user?.id}
      createdDate={event.createdAt}
      footerVoteButton={
        <VoteButton
          targetId={event.id}
          module="CALL_FOR_PAPER"
          initialTotalVotes={event.totalVotes}
          initialUserVote={userVote}
          isOwnContent={user?.id === event.author?.id}
        />
      }
      footerBookmarkButton={
        <BookmarkButton
          frozen={event.isFrozen === true}
          targetId={event.id}
          module="CALL_FOR_PAPER"
          initialTotalBookmarks={event.totalBookmarks ?? 0}
          initialIsBookmarked={
            Array.isArray(event.bookmarks) && event.bookmarks.length > 0
          }
        />
      }
      footerCommentsHref={`/call-for-papers/${event.id}#comments`}
      footerCommentsCount={event.totalComments}
      footerReportMenu={
        <ReportMenu
          entityId={event.id}
          entityType="POST"
          module="CALL_FOR_PAPER"
          ownerId={event.author?.id ?? null}
          currentUserId={user?.id ?? null}
          isFrozen={event.isFrozen}
          hasActiveAppeal={event.hasActiveAppeal}
        />
      }
      bodyBottomContent={
        <div className="flex gap-3 sm:gap-4 mt-3 sm:mt-4">
          <SmartExternalLink
            url={event.notificationLink}
            className="flex-1 sb-button-soft"
            urlLabel="View Brochure"
          />
          <SmartExternalLink
            url={event.applyLink}
            className="flex-1 sb-button-primary"
            urlLabel="Register Now"
            emailLabel="Email to Register"
          />
        </div>
      }
      discussion={
        <CommentSection
          locked={event.isFrozen ?? false}
          comments={event.comments}
          totalComments={event.totalComments}
          targetId={event.id}
          module="callForPaper"
          currentUserId={user?.id || null}
          postAuthorId={event.author?.id}
        />
      }
    >
      <div className="mb-4">
        <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
          {getCallForPaperCategoryLabel(event.category)}
        </span>
      </div>
      <h1 className="mb-1.5 sm:mb-2 min-w-0 max-w-full break-words text-lg sm:text-xl md:text-2xl font-bold text-slate-950 [overflow-wrap:anywhere]">
        {event.title}
      </h1>

      <div className="mb-4 sm:mb-6 space-y-2 sm:space-y-3">
        <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-600">
          <Calendar className="h-4 w-4 sm:h-5 sm:w-5 shrink-0 text-slate-400" />
          <span className="font-semibold">Date:</span>
          <span>
            {event.eventDate ? new Date(event.eventDate).toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            }) : "Date to be announced"}
          </span>
        </div>
        {/* Journal and publisher are separate rows: they are different things,
            and a combined "journal · publisher" string reads as one value. */}
        {event.journal && (
          <div className="flex min-w-0 items-center gap-2 text-xs sm:text-sm text-slate-600">
            <BookOpen className="h-4 w-4 sm:h-5 sm:w-5 shrink-0 text-slate-400" />
            <span className="shrink-0 font-semibold">Journal:</span>
            <span className="min-w-0 flex-1 break-words [overflow-wrap:anywhere]">
              {event.journal.title}
            </span>
          </div>
        )}
        {event.publisher && (
          <div className="flex min-w-0 items-center gap-2 text-xs sm:text-sm text-slate-600">
            <Building2 className="h-4 w-4 sm:h-5 sm:w-5 shrink-0 text-slate-400" />
            <span className="shrink-0 font-semibold">Publisher:</span>
            <span className="min-w-0 flex-1 break-words [overflow-wrap:anywhere]">
              {event.publisher}
            </span>
          </div>
        )}
        {event.location && (
          <div className="flex min-w-0 items-center gap-2 text-xs sm:text-sm text-slate-600">
            <MapPin className="h-4 w-4 sm:h-5 sm:w-5 shrink-0 text-slate-400" />
            <span className="shrink-0 font-semibold">Location:</span>
            <span className="min-w-0 flex-1 break-words [overflow-wrap:anywhere]">{event.location}</span>
          </div>
        )}
        {event.deadline && (
          <div className="flex min-w-0 items-center gap-2 text-xs sm:text-sm text-slate-600">
            <Clock className="h-4 w-4 sm:h-5 sm:w-5 shrink-0 text-slate-400" />
            <span className="shrink-0">Registration Deadline:</span>
            <span className="min-w-0 flex-1 break-words font-medium [overflow-wrap:anywhere]">
              {new Date(event.deadline).toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </div>
        )}
      </div>

      {isValidImageUrl(event.imageUrl) && (
        <div className="mb-6">
          <FeedImage
            src={event.imageUrl}
            alt={event.title}
            className="block w-full object-cover rounded-xl"
          />
        </div>
      )}

      <RichContent
        content={event.description}
        className="text-slate-800 leading-relaxed"
      />
    </DetailPageCardShell>
  );
};

export default EventDetailPage;
