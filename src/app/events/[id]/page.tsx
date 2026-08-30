import { notFound } from "next/navigation";
import { CommentSection } from "@/components/interactions/CommentSection";
import { createClient } from "@/utils/supabase/server";
import { VoteButton } from "@/components/interactions/VoteButton";

import { deleteResearchEvent, getEvent } from "@/app/actions/events";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";
import DetailPageCardShell from "@/components/cards/DetailPageCardShell";
import { ReportMenu } from "@/components/cards/ReportMenu";
import { RichContent } from "@/components/content/RichContent";
import { Calendar, Clock, MapPin } from "lucide-react";

import { buildMetadata } from "@/lib/seo";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const event = await getEvent(id).catch(() => null);
  if (!event) return { title: "Research Event" };
  const location = event.location ? ` at ${event.location}` : "";
  return buildMetadata({
    title: event.title,
    description: `Academic event / conference${location}. ${new Date(event.date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}.`,
    path: `/events/${event.id}`,
    type: "article",
    publishedTime: event.createdAt,
    section: "Academic Events",
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
    notFound();
  }

  const userVote =
    (event.votes?.find((v) => v.userId === user?.id)?.voteType as
      "UPVOTE" | "DOWNVOTE" | null) ?? null;

  return (
    <DetailPageCardShell
      isFrozen={event.isFrozen ?? false}
      backHref="/events"
      backLabel="Back to Events"
      authorHref={`/scholars/${event.author?.id}`}
      authorName={event.author?.name || "Scholar"}
      authorHandle={event.author?.handle || undefined}
      authorAvatarUrl={event.author?.avatarUrl || undefined}
      managementControls={
        user?.id === event.author?.id ? (
          <OwnerActionsDropdown
            editHref={`/events/${event.id}/edit`}
            onDelete={async () => {
              "use server";
              await deleteResearchEvent(event.id);
              return { redirect: "/events" };
            }}
            isOwner={true}
            editLabel="Edit Event"
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
          module="RESEARCH_EVENT"
          initialTotalVotes={event.totalVotes}
          initialUserVote={userVote}
        />
      }
      footerCommentsHref={`/events/${event.id}#comments`}
      footerCommentsCount={event.totalComments}
      footerReportMenu={
        <ReportMenu
          entityId={event.id}
          entityType="POST"
          module="RESEARCH_EVENT"
          contentType="event"
          ownerId={event.author?.id ?? null}
          currentUserId={user?.id ?? null}
          isFrozen={event.isFrozen}
          isDeleted={false}
          isAppealedByOwner={event.isAppealedByOwner}
        />
      }
      bodyBottomContent={
        <div className="flex gap-3 sm:gap-4 mt-3 sm:mt-4">
          {event.notificationLink && (
            <a
              href={event.notificationLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 sb-button-soft"
            >
              View Brochure
            </a>
          )}
          {event.applyLink && (
            <a
              href={event.applyLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 sb-button-primary"
            >
              Register Now
            </a>
          )}
        </div>
      }
      discussion={
        <CommentSection
          locked={event.isFrozen ?? false}
          comments={event.comments}
          totalComments={event.totalComments}
          targetId={event.id}
          module="event"
          currentUserId={user?.id || null}
          postAuthorId={event.author?.id}
        />
      }
    >
      <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-950 mb-1.5 sm:mb-2">
        {event.title}
      </h1>

      <div className="mb-4 sm:mb-6 space-y-2 sm:space-y-3">
        <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-600">
          <Calendar className="h-4 w-4 sm:h-5 sm:w-5 shrink-0 text-slate-400" />
          <span className="font-semibold">Event Date:</span>
          <span>
            {new Date(event.date).toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        </div>
        {event.location && (
          <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-600">
            <MapPin className="h-4 w-4 sm:h-5 sm:w-5 shrink-0 text-slate-400" />
            <span className="font-semibold">Location:</span>
            <span>{event.location}</span>
          </div>
        )}
        {event.deadline && (
          <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-600">
            <Clock className="h-4 w-4 sm:h-5 sm:w-5 shrink-0 text-slate-400" />
            <span>Registration Deadline:</span>
            <span className="font-medium">
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

      <RichContent
        content={event.description}
        className="text-slate-800 leading-relaxed"
      />
    </DetailPageCardShell>
  );
};

export default EventDetailPage;
