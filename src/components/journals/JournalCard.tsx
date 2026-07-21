"use client";

import { Journal, User } from "@prisma/client";
import ListPageCardShell from "@/components/cards/ListPageCardShell";
import { LikeButton } from "@/components/interactions/LikeButton";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";

type JournalWithAuthor = Journal & {
  author: User & {
    followers?: { followerId: string }[];
  };
  isLiked: boolean;
  _count: { likes: number; comments: number };
};

export function JournalCard({
  journal,
  currentUserId,
}: {
  journal: JournalWithAuthor;
  currentUserId?: string;
}) {
  const isOwner = currentUserId === journal.authorId;
  const isFollowing = (journal.author.followers?.length ?? 0) > 0;

  return (
    <ListPageCardShell
      authorHref={`/scholar/${journal.author.id}`}
      authorName={journal.author.name || "Scholar"}
      authorId={journal.author.id}
      isFollowing={isFollowing}
      authorHandle={journal.author.handle || undefined}
      authorAvatarUrl={journal.author.avatarUrl || undefined}
      detailPageHref={`/journals/${journal.id}`}
      managementControls={
        isOwner && (
          <OwnerActionsDropdown
            editHref={`/journals/${journal.id}/edit`}
            isOwner={true}
            editLabel="Edit Journal"
            deleteLabel="Delete"
            onDelete={() => {
              // TODO: wire delete action if available
            }}
          />
        )
      }
      createdDate={journal.createdAt}
      editedDate={
        journal.updatedAt > journal.createdAt ? journal.updatedAt : undefined
      }
      footerLikeButton={
        <LikeButton
          targetId={journal.id}
          type="journal"
          initialLikes={journal._count.likes}
          initialIsLiked={journal.isLiked}
        />
      }
      footerCommentsHref={`/journals/${journal.id}`}
      footerCommentsCount={journal._count.comments}
    >
      <h2 className="mb-2 text-lg font-semibold leading-tight text-slate-950 group-hover:text-blue-700 transition-colors">
        {journal.title}
      </h2>

      <p className="text-sm leading-relaxed text-slate-600 line-clamp-3">
        {journal.about}
      </p>

      {journal.issn && (
        <div className="mt-6 rounded-xl border border-blue-100/50 bg-blue-50/50 p-2 text-xs font-semibold text-blue-600">
          ISSN: {journal.issn}
        </div>
      )}
    </ListPageCardShell>
  );
}
