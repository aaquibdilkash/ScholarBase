"use client";

import { ResearchEvent, User } from "@prisma/client";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";
import ListPageCardShell from "@/components/cards/ListPageCardShell";
import { LikeButton } from "@/components/interactions/LikeButton";
import { deleteResearchEvent } from "@/app/actions/events";

type EventWithAuthor = ResearchEvent & {
  author: User;
  isLiked: boolean;
  _count: { likes: number; comments: number };
};

export function EventCard({
  event,
  currentUserId,
}: {
  event: EventWithAuthor;
  currentUserId?: string;
}) {
  const isOwner = currentUserId === event.authorId;
  return (
    <ListPageCardShell
      authorHref={`/scholar/${event.author.id}`}
      authorName={event.author.name || "Scholar"}
      authorHandle={event.author.handle || undefined}
      authorAvatarUrl={event.author.avatarUrl || undefined}
      detailPageHref={`/events/${event.id}`}
      managementControls={
        isOwner && (
          <OwnerActionsDropdown
            editHref={`/events/${event.id}/edit`}
            isOwner={true}
            onDelete={async () => {
              await deleteResearchEvent(event.id);
            }}
            editLabel="Edit Event"
            deleteLabel="Delete"
          />
        )
      }
      footerLikeButton={
        <LikeButton
          targetId={event.id}
          type="event"
          initialLikes={event._count.likes}
          initialIsLiked={event.isLiked}
        />
      }
      footerCommentsHref={`/events/${event.id}`}
      footerCommentsCount={event._count.comments}
    >
      <h2 className="mb-2 text-lg font-semibold leading-tight text-slate-950">
        {event.title}
      </h2>
      <p className="mb-4 text-sm font-medium text-slate-600">
        Event Date:{" "}
        {new Date(event.date).toLocaleDateString("en-US", {
          dateStyle: "medium",
        })}
      </p>

      <p className="text-sm leading-relaxed text-slate-600 line-clamp-3">
        {event.description}
      </p>
    </ListPageCardShell>
  );
}
