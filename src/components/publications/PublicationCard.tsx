"use client";

import { Publication, User } from "@prisma/client";
import ListPageCardShell from "@/components/cards/ListPageCardShell";
import { VoteButton } from "@/components/interactions/VoteButton";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";
import { RichContent } from "@/components/content/RichContent";

type PublicationWithAuthor = Publication & {
  author: User & {
    followers?: { followerId: string }[];
  };
  votes: any[];
  _count: { votes: number; comments: number };
};

const PUBLICATION_TYPE_LABELS: Record<string, string> = {
  RESEARCH_PAPER: "Research Paper",
  CONFERENCE_PROCEEDING: "Conference Proceeding",
  PREPRINT: "Preprint",
  BOOK: "Book",
  BOOK_CHAPTER: "Book Chapter",
  THESIS: "Thesis",
  TECHNICAL_REPORT: "Technical Report",
  OTHER: "Other",
};

export function PublicationCard({
  publication,
  currentUserId,
}: {
  publication: PublicationWithAuthor;
  currentUserId?: string;
}) {
  const isOwner = currentUserId === publication.authorId;
  const isFollowing = (publication.author.followers?.length ?? 0) > 0;
  const userVote: "UPVOTE" | "DOWNVOTE" | null =
    publication.votes?.find((v: any) => v.userId === currentUserId)?.voteType ??
    null;
  const upvoteCount =
    publication.votes?.filter((v: any) => v.voteType === "UPVOTE").length ?? 0;
  const downvoteCount =
    publication.votes?.filter((v: any) => v.voteType === "DOWNVOTE").length ??
    0;

  return (
    <ListPageCardShell
      authorHref={`/scholar/${publication.author.id}`}
      authorName={publication.author.name || "Scholar"}
      authorId={publication.author.id}
      isFollowing={isFollowing}
      authorHandle={publication.author.handle || undefined}
      authorAvatarUrl={publication.author.avatarUrl || undefined}
      detailPageHref={`/publications/${publication.id}`}
      managementControls={
        isOwner && (
          <OwnerActionsDropdown
            editHref={`/publications/${publication.id}/edit`}
            isOwner={true}
            editLabel="Edit Publication"
            deleteLabel="Delete"
            onDelete={() => {
              // TODO: wire delete action if available
            }}
          />
        )
      }
      createdDate={publication.createdAt}
      editedDate={
        publication.updatedAt > publication.createdAt
          ? publication.updatedAt
          : undefined
      }
      footerVoteButton={
        <VoteButton
          targetId={publication.id}
          type="publication"
          initialUpvotes={upvoteCount}
          initialDownvotes={downvoteCount}
          initialUserVote={userVote}
        />
      }
      footerCommentsHref={`/publications/${publication.id}`}
      footerCommentsCount={publication._count.comments}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <h2 className="text-lg font-semibold leading-tight text-slate-950 group-hover:text-blue-700 transition-colors">
          {publication.title}
        </h2>
        <span className="shrink-0 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
          {PUBLICATION_TYPE_LABELS[publication.publicationType] ||
            publication.publicationType}
        </span>
      </div>

      <p className="text-sm text-slate-500 mb-2">
        <span className="font-medium text-slate-700">Authors:</span>{" "}
        {publication.authors}
      </p>

      {publication.abstract && (
        <RichContent
          content={publication.abstract}
          className="text-sm leading-relaxed text-slate-600 line-clamp-3"
        />
      )}

      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
        {publication.journalOrConference && (
          <span className="rounded-md bg-slate-100 px-2 py-1">
            {publication.journalOrConference}
          </span>
        )}
        {publication.year && (
          <span className="rounded-md bg-slate-100 px-2 py-1">
            {publication.year}
          </span>
        )}
        {publication.domain && (
          <span className="rounded-md bg-emerald-50 px-2 py-1 text-emerald-700 font-medium">
            {publication.domain}
          </span>
        )}
        {publication.isUserAuthor && (
          <span className="rounded-md bg-amber-50 px-2 py-1 text-amber-700 font-medium">
            Co-author
          </span>
        )}
      </div>

      {publication.keywords && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {publication.keywords.split(",").map((kw, i) => (
            <span
              key={i}
              className="rounded-full bg-purple-50 px-2 py-0.5 text-xs text-purple-700"
            >
              {kw.trim()}
            </span>
          ))}
        </div>
      )}

      {publication.url && (
        <div className="flex gap-3 mt-4">
          <a
            href={publication.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex-1 rounded-lg bg-slate-950 py-2 text-center text-xs font-semibold text-white transition-colors duration-200 hover:bg-slate-800"
          >
            View Publication
          </a>
        </div>
      )}
    </ListPageCardShell>
  );
}
