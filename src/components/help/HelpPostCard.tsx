"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import ListPageCardShell from "@/components/cards/ListPageCardShell";
import { ReportMenu } from "@/components/cards/ReportMenu";
import { VoteButton } from "@/components/interactions/VoteButton";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";
import { deleteHelpPost } from "@/app/actions/help";
import { RichContent } from "@/components/content/RichContent";
import type { HelpPostWithAuthor } from "@/types/cards";
import { useToast } from "@/components/ui/Toast";

export function HelpPostCard({
  helpPost,
  currentUserId,
}: {
  helpPost: HelpPostWithAuthor;
  currentUserId?: string;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isOwner = currentUserId === helpPost.authorId;
  const isFollowing = (helpPost.author?.followers?.length ?? 0) > 0;
  
  // The 'votes' prop is now a filtered select returning an array with 0 or 1 elements.
  const initialUserVote = helpPost.votes && helpPost.votes.length > 0 ? helpPost.votes[0].voteType : null;

  const deleteMutation = useMutation({
    mutationFn: deleteHelpPost,
    onSuccess: (response) => {
       if (!response.success || !response.data) {
         toast({ title: "Error", description: "Failed to delete post.", variant: "destructive" });
         return;
       }
      queryClient.setQueryData<HelpPostWithAuthor[]>(
        ["helpPosts", { q: "" }],
        (oldData = []) =>
          oldData.filter((p) => p.id !== response.data?.deletedId),
      );
      toast({ title: "Success", description: "Post deleted successfully." });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  return (
    <ListPageCardShell
      authorHref={`/scholars/${helpPost.author?.id}`}
      authorName={helpPost.author?.name || "Scholar"}
      authorId={helpPost.author?.id}
      isFollowing={isFollowing}
      currentUserId={currentUserId}
      authorHandle={helpPost.author?.handle || undefined}
      authorAvatarUrl={helpPost.author?.avatarUrl || undefined}
      detailPageHref={`/help/${helpPost.id}`}
      managementControls={
        isOwner && (
          <OwnerActionsDropdown
            editHref={`/help/${helpPost.id}/edit`}
            isOwner={true}
            editLabel="Edit Help Post"
            deleteLabel="Delete"
            onDelete={() => { deleteMutation.mutate(helpPost.id); return { refresh: false }; }}
          />
        )
      }
      createdDate={helpPost.createdAt}
      editedDate={
        helpPost.editedAt && helpPost.editedAt > helpPost.createdAt ? helpPost.editedAt : undefined
      }
      footerVoteButton={
        <VoteButton
          targetId={helpPost.id}
          module="HELP_POST"
          initialTotalVotes={helpPost.totalVotes}
          initialUserVote={initialUserVote}
        />
      }
      footerCommentsHref={`/help/${helpPost.id}`}
      footerCommentsCount={helpPost.totalComments}
      footerReportMenu={
        <ReportMenu entityId={helpPost.id} entityType="POST" module="HELP_POST" />
      }
    >
      <div className="mb-4">
        <h2 className="mb-1 text-lg font-semibold leading-tight text-slate-950 group-hover:text-blue-700 transition-colors">
          {helpPost.title}
        </h2>
        <p className="text-sm font-semibold text-blue-700">
          {helpPost.category}
        </p>
        {helpPost.subject && (
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            <span className="font-semibold text-slate-800 dark:text-slate-100">
              Subject:
            </span>{" "}
            {helpPost.subject}
          </p>
        )}
      </div>

      <RichContent
        content={helpPost.message}
        className="text-sm leading-relaxed text-slate-600 line-clamp-4"
      />
    </ListPageCardShell>
  );
}
