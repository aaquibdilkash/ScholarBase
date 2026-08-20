"use client";

import ListPageCardShell from "@/components/cards/ListPageCardShell";
import { VoteButton } from "@/components/interactions/VoteButton";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";
import { RichContent } from "@/components/content/RichContent";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deletePublication } from "@/app/actions/publications";
import { useToast } from "@/components/ui/Toast";
import type { PublicationWithAuthor } from "@/types/cards";

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
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isOwner = currentUserId === publication.authorId;
  const isFollowing = (publication.author.followers?.length ?? 0) > 0;
  const userVote: "UPVOTE" | "DOWNVOTE" | null =
    (publication.votes || [])[0]?.voteType ??
    null;

  const deleteMutation = useMutation({
    mutationFn: deletePublication,
    onSuccess: (response) => {
      if (!response.success || !response.data) {
        toast("Failed to delete publication.", "error");
        return;
      }
      queryClient.setQueriesData(
        { queryKey: ["publications"] },
        (oldData: PublicationWithAuthor[] = []) =>
          oldData.filter((p) => p.id !== response.data.deletedId),
      );
      toast("Publication deleted successfully.", "success");
    },
    onError: (error) => toast(error.message, "error"),
  });

  return (
    <ListPageCardShell
      authorHref={`/scholars/${publication.author.id}`}
      authorName={publication.author.name || "Scholar"}
      authorId={publication.author.id}
      isFollowing={isFollowing}
      currentUserId={currentUserId}
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
              deleteMutation.mutate(publication.id);
              return { refresh: false };
            }}
          />
        )
      }
      createdDate={publication.createdAt}
      editedDate={
        publication.editedAt && publication.editedAt > publication.createdAt
          ? publication.editedAt
          : undefined
      }
      footerVoteButton={
        <VoteButton
          targetId={publication.id}
          module="PUBLICATION"
          initialTotalVotes={publication.totalVotes ?? 0}
          initialUserVote={userVote}
        />
      }
      footerCommentsHref={`/publications/${publication.id}`}
      footerCommentsCount={publication.totalComments}
      noBodyLink={true}
      bodyBottomContent={
        publication.url && (
          <div className="flex gap-3 mt-4">
            <a
              href={publication.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 rounded-lg bg-slate-950 py-2 text-center text-xs font-semibold text-white transition-colors duration-200 hover:bg-slate-800"
            >
              View Publication
            </a>
          </div>
        )
      }
    >
      <Link href={`/publications/${publication.id}`} className="block group">
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
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              {publication.journalOrConference}
            </span>
          )}
          {publication.year && (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              {publication.year}
            </span>
          )}
          {publication.domain && (
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
              {publication.domain}
            </span>
          )}
          {publication.isUserAuthor && (
            <span className="rounded-full bg-amber-50 px-2.5 py-1 font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
              Co-author
            </span>
          )}
        </div>

        {publication.keywords && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {publication.keywords.split(",").map((kw, i) => (
              <span
                key={i}
                className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                {kw.trim()}
              </span>
            ))}
          </div>
        )}
      </Link>
    </ListPageCardShell>
  );
}
