"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import ListPageCardShell from "@/components/cards/ListPageCardShell";
import { ReportMenu } from "@/components/cards/ReportMenu";
import Link from "next/link";
import { VoteButton } from "@/components/interactions/VoteButton";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";
import { RichContent } from "@/components/content/RichContent";
import { deleteJournal } from "@/app/actions/journals";
import { useToast } from "@/components/ui/Toast";
import type { JournalWithAuthor } from "@/types/cards";

export function JournalCard({
  journal,
  currentUserId,
}: {
  journal: JournalWithAuthor;
  currentUserId?: string;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isOwner = currentUserId === journal.authorId;
  const isFollowing = (journal.author?.followers?.length ?? 0) > 0;
  const userVote: "UPVOTE" | "DOWNVOTE" | null =
    (journal.votes || [])[0]?.voteType ?? null;

  const deleteMutation = useMutation({
    mutationFn: deleteJournal,
    onSuccess: (response) => {
      if (!response.success || !response.data) {
        toast("Failed to delete journal.", "error");
        return;
      }
      queryClient.setQueriesData(
        { queryKey: ["journals"] },
        (oldData: JournalWithAuthor[] = []) =>
          oldData.filter((j) => j.id !== response.data.deletedId),
      );
      toast("Journal deleted successfully.", "success");
    },
    onError: (error) => toast(error.message, "error"),
  });

  return (
    <ListPageCardShell
      authorHref={`/scholars/${journal.author?.id}`}
      authorName={journal.author?.name || "Scholar"}
      authorId={journal.author?.id}
      isFollowing={isFollowing}
      currentUserId={currentUserId}
      authorHandle={journal.author?.handle || undefined}
      authorAvatarUrl={journal.author?.avatarUrl || undefined}
      detailPageHref={`/journals/${journal.id}`}
      noBodyLink={true}
      managementControls={
        isOwner && (
          <OwnerActionsDropdown
            editHref={`/journals/${journal.id}/edit`}
            isOwner={true}
            editLabel="Edit Journal"
            deleteLabel="Delete"
            onDelete={() => {
              deleteMutation.mutate(journal.id);
              return { refresh: false };
            }}
          />
        )
      }
      createdDate={journal.createdAt}
      editedDate={
        journal.editedAt && journal.editedAt > journal.createdAt ? journal.editedAt : undefined
      }
      footerVoteButton={
        <VoteButton
          frozen={journal.isFrozen === true}
          targetId={journal.id}
          module="JOURNAL"
          initialTotalVotes={journal.totalVotes ?? 0}
          initialUserVote={userVote}
        />
      }
      footerCommentsHref={`/journals/${journal.id}`}
      footerCommentsCount={journal.totalComments}
      footerReportMenu={
        <ReportMenu entityId={journal.id} entityType="POST" module="JOURNAL" contentType="journal" />
      }
      bodyBottomContent={
        <>
          {journal.website && (
            <div className="mt-4 flex gap-3">
              <a
                href={journal.website}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="sb-button-primary flex-1 px-4 py-2 text-center text-xs"
              >
                View Website
              </a>
            </div>
          )}
        </>
      }
    >
      <Link href={`/journals/${journal.id}`} className="block group">
        <h2 className="mb-2 text-lg font-semibold leading-tight text-slate-950 group-hover:text-blue-700 transition-colors">
          {journal.title}
        </h2>

        <RichContent
          content={journal.about}
          className="text-sm leading-relaxed text-slate-600 line-clamp-3"
        />

        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
          {journal.publisher && (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              {journal.publisher}
            </span>
          )}
          {journal.issn && (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              ISSN: {journal.issn}
            </span>
          )}
          {journal.impactFactor && (
            <span className="rounded-full bg-amber-50 px-2.5 py-1 font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
              IF: {journal.impactFactor}
            </span>
          )}
          {journal.scopusQuartile && journal.scopusQuartile !== "NONE" && (
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
              Scopus: {journal.scopusQuartile}
            </span>
          )}
          {journal.abdcRanking && journal.abdcRanking !== "NONE" && (
            <span className="rounded-full bg-purple-50 px-2.5 py-1 font-medium text-purple-700 dark:bg-purple-500/10 dark:text-purple-300">
              ABDC: {journal.abdcRanking.replace("_STAR", "*")}
            </span>
          )}
          {journal.wosIndex && journal.wosIndex !== "NONE" && (
            <span className="rounded-full bg-blue-50 px-2.5 py-1 font-medium text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
              WoS: {journal.wosIndex}
            </span>
          )}
          {journal.wosQuartile && journal.wosQuartile !== "NONE" && (
            <span className="rounded-full bg-sky-50 px-2.5 py-1 font-medium text-sky-700 dark:bg-sky-500/10 dark:text-sky-300">
              WoS Q: {journal.wosQuartile}
            </span>
          )}
          {journal.sjrQuartile && journal.sjrQuartile !== "NONE" && (
            <span className="rounded-full bg-orange-50 px-2.5 py-1 font-medium text-orange-700 dark:bg-orange-500/10 dark:text-orange-300">
              SJR Q: {journal.sjrQuartile}
            </span>
          )}
          {journal.sjrScore != null && (
            <span className="rounded-full bg-orange-50 px-2.5 py-1 font-medium text-orange-700 dark:bg-orange-500/10 dark:text-orange-300">
              SJR: {journal.sjrScore}
            </span>
          )}
          {journal.citeScore != null && (
            <span className="rounded-full bg-teal-50 px-2.5 py-1 font-medium text-teal-700 dark:bg-teal-500/10 dark:text-teal-300">
              CiteScore: {journal.citeScore}
            </span>
          )}
        </div>
      </Link>
    </ListPageCardShell>
  );
}
