import { notFound } from "next/navigation";
import { CommentSection } from "@/components/interactions/CommentSection";
import { createClient } from "@/utils/supabase/server";
import { VoteButton } from "@/components/interactions/VoteButton";

import { deleteResearchEvent, getEvent } from "@/app/actions/events";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";
import DetailPageCardShell from "@/components/cards/DetailPageCardShell";
import { RichContent } from "@/components/content/RichContent";

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

  const upvotes =
    event.votes?.filter((v: any) => v.voteType === "UPVOTE").length ?? 0;
  const downvotes =
    event.votes?.filter((v: any) => v.voteType === "DOWNVOTE").length ?? 0;
  const userVote =
    (event.votes?.find((v: any) => v.userId === user?.id)?.voteType as
      | "UPVOTE"
      | "DOWNVOTE"
      | null) ?? null;

  return (
    <DetailPageCardShell
      backHref="/events"
      backLabel="Back to Events"
      authorHref={`/scholar/${event.author.id}`}
      authorName={event.author.name || "Scholar"}
      authorHandle={event.author.handle || undefined}
      authorAvatarUrl={event.author.avatarUrl || undefined}
      managementControls={
        user?.id === event.author.id ? (
          <OwnerActionsDropdown
            editHref={`/events/${event.id}/edit`}
            onDelete={async () => {
              "use server";
              await deleteResearchEvent(event.id);
            }}
            isOwner={true}
            editLabel="Edit Event"
            deleteLabel="Delete"
          />
        ) : null
      }
      authorId={event.author.id}
      isFollowing={(event.author as any)?.followers?.length ? true : false}
      createdDate={event.createdAt}
      footerVoteButton={
        <VoteButton
          targetId={event.id}
          type="event"
          initialUpvotes={upvotes}
          initialDownvotes={downvotes}
          initialUserVote={userVote}
        />
      }
      footerCommentsHref={`/events/${event.id}#comments`}
      footerCommentsCount={event._count.comments}
      bodyBottomContent={
        <div className="flex gap-4 mt-4">
          {event.notificationLink && (
            <a
              href={event.notificationLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 rounded-lg bg-slate-100 py-2.5 text-center text-sm font-semibold text-slate-700 transition-colors duration-200 hover:bg-slate-200"
            >
              View Brochure
            </a>
          )}
          {event.applyLink && (
            <a
              href={event.applyLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 rounded-lg bg-slate-950 py-2.5 text-center text-sm font-semibold text-white transition-colors duration-200 hover:bg-slate-800"
            >
              Register Now
            </a>
          )}
        </div>
      }
      discussion={
        <div
          className="mt-8 sb-surface-strong p-8 md:p-12 rounded-xl"
          id="comments"
        >
          <h2 className="text-2xl font-bold text-slate-950 mb-6">Discussion</h2>
          <CommentSection
            comments={event.comments}
            targetId={event.id}
            type="event"
            currentUserId={user?.id || null}
            postAuthorId={event.author.id}
          />
        </div>
      }
    >
      <h1 className="text-2xl md:text-3xl font-bold text-slate-950 mb-2">
        {event.title}
      </h1>

      <div className="mb-6 space-y-3">
        <div className="flex items-center gap-2 text-slate-600">
          <svg
            className="h-5 w-5 shrink-0 text-slate-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
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
          <div className="flex items-center gap-2 text-slate-600">
            <svg
              className="h-5 w-5 shrink-0 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <span className="font-semibold">Location:</span>
            <span>{event.location}</span>
          </div>
        )}
        {event.deadline && (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <svg
              className="h-5 w-5 shrink-0 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
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
