"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import ListPageCardShell from "@/components/cards/ListPageCardShell";
import { VoteButton } from "@/components/interactions/VoteButton";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";
import { RichContent } from "@/components/content/RichContent";
import Link from "next/link";
import { deleteResearchTool } from "@/app/actions/researchTools";
import { useToast } from "@/components/ui/Toast";
import type { ResearchToolWithAuthor } from "@/types/cards";

export function ResearchToolCard({
  tool,
  currentUserId,
}: {
  tool: ResearchToolWithAuthor;
  currentUserId?: string;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isOwner = currentUserId === tool.authorId;
  const isFollowing = (tool.author?.followers?.length ?? 0) > 0;
  const userVote: "UPVOTE" | "DOWNVOTE" | null =
    ((tool.votes || []) as { userId: string; voteType: "UPVOTE" | "DOWNVOTE" }[]).find((v) => v.userId === currentUserId)?.voteType ?? null;

  const deleteMutation = useMutation({
    mutationFn: deleteResearchTool,
    onSuccess: (response) => {
      if (!response.success || !response.data) {
        toast("Failed to delete tool.", "error");
        return;
      }
      queryClient.setQueriesData(
        { queryKey: ["researchTools"] },
        (oldData: ResearchToolWithAuthor[] = []) =>
          oldData.filter((t) => t.id !== response.data.deletedId),
      );
      toast("Tool deleted successfully.", "success");
    },
    onError: (error) => toast(error.message, "error"),
  });

  return (
    <ListPageCardShell
      authorHref={`/scholars/${tool.author?.id}`}
      authorName={tool.author?.name || "Scholar"}
      authorId={tool.author?.id}
      isFollowing={isFollowing}
      currentUserId={currentUserId}
      authorHandle={tool.author?.handle || undefined}
      authorAvatarUrl={tool.author?.avatarUrl || undefined}
      detailPageHref={`/research-tools/${tool.id}`}
      managementControls={
        isOwner && (
          <OwnerActionsDropdown
            editHref={`/research-tools/${tool.id}/edit`}
            isOwner={true}
            editLabel="Edit Tool"
            deleteLabel="Delete"
            onDelete={() => {
              deleteMutation.mutate(tool.id);
              return { refresh: false };
            }}
          />
        )
      }
      createdDate={tool.createdAt}
      editedDate={tool.editedAt && tool.editedAt > tool.createdAt ? tool.editedAt : undefined}
      footerVoteButton={
        <VoteButton
          targetId={tool.id}
          module="RESEARCH_TOOL"
          initialTotalVotes={tool.totalVotes ?? 0}
          initialUserVote={userVote}
        />
      }
      footerCommentsHref={`/research-tools/${tool.id}`}
      footerCommentsCount={tool.totalComments}
      noBodyLink={true}
      bodyBottomContent={
        tool.website && (
          <a
            href={tool.website}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 block rounded-lg bg-slate-950 py-2 text-center text-xs font-semibold text-white transition-colors duration-200 hover:bg-slate-800"
          >
            Visit Tool
          </a>
        )
      }
    >
      <Link href={`/research-tools/${tool.id}`} className="block group">
        <h2 className="mb-2 text-lg font-semibold leading-tight text-slate-950 group-hover:text-blue-700 transition-colors">
          {tool.name}
        </h2>
        {tool.use && (
          <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
            <span className="font-semibold text-slate-800 dark:text-slate-100">
              Primary use:
            </span>{" "}
            {tool.use}
          </p>
        )}
        <RichContent
          content={tool.description}
          className="text-sm leading-relaxed text-slate-600 line-clamp-3"
        />
      </Link>
    </ListPageCardShell>
  );
}
