import { notFound } from "next/navigation";
import { CommentSection } from "@/components/interactions/CommentSection";
import { createClient } from "@/utils/supabase/server";
import { LikeButton } from "@/components/interactions/LikeButton";

import { deleteResearchEvent, getEvent } from "@/app/actions/events";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";
import DetailPageCardShell from "@/components/cards/DetailPageCardShell";

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
      footerLikeButton={
        <LikeButton
          targetId={event.id}
          type="event"
          initialLikes={event._count.likes}
          initialIsLiked={!!event.likes?.length}
        />
      }
      footerCommentsHref={`/events/${event.id}#comments`}
      footerCommentsCount={event._count.comments}
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
      <p className="text-md font-medium text-slate-600 mb-6">
        {event.location}
      </p>

      <p className="text-slate-800 whitespace-pre-wrap leading-relaxed mb-6">
        {event.description}
      </p>

      <div className="mb-6 flex items-center gap-2 rounded-xl border-blue-100/50 bg-blue-50/50 p-3 text-sm font-semibold text-blue-600">
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
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          ></path>
        </svg>
        Event Date: {new Date(event.date).toLocaleDateString("en-US")}
      </div>

      {event.deadline && (
        <div className="mb-6 flex items-center gap-2 rounded-xl border border-red-100/50 bg-red-50/50 p-3 text-sm font-semibold text-red-600">
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
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            ></path>
          </svg>
          Registration Deadline:{" "}
          {new Date(event.deadline).toLocaleDateString("en-US")}
        </div>
      )}

      <div className="flex gap-4 mb-8">
        {event.notificationLink && (
          <a
            href={event.notificationLink}
            target="_blank"
            rel="noopener noreferrer"
            className="sb-button-accent"
          >
            View Brochure
          </a>
        )}
        {event.applyLink && (
          <a
            href={event.applyLink}
            target="_blank"
            rel="noopener noreferrer"
            className="sb-button-accent"
          >
            Register Now
          </a>
        )}
      </div>
    </DetailPageCardShell>
  );
};

export default EventDetailPage;
