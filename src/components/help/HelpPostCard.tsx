"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import ListPageCardShell from "@/components/cards/ListPageCardShell";
import { VoteButton } from "@/components/interactions/VoteButton";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";
import { deleteHelpPostSafe } from "@/app/actions/help";
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
  const isFollowing = (helpPost.author.followers?.length ?? 0) > 0;
  const userVote: "UPVOTE" | "DOWNVOTE" | null =
    helpPost.votes?.find((v) => v.userId === currentUserId)?.voteType ?? null;
  const upvoteCount =
    helpPost.votes?.filter((v) => v.voteType === "UPVOTE").length ?? 0;
  const downvoteCount =
    helpPost.votes?.filter((v) => v.voteType === "DOWNVOTE").length ?? 0;

  const deleteMutation = useMutation({
    mutationFn: deleteHelpPostSafe,
    onSuccess: (response) => {
      if (!response.success || !response.data) {
        toast(response.error || "Failed to delete post.", "error");
        return;
      }
      queryClient.setQueryData<HelpPostWithAuthor[]>(
        ["helpPosts", { q: "" }],
        (oldData = []) =>
          oldData.filter((p) => p.id !== response.data?.deletedId),
      );
      toast("Post deleted successfully.", "success");
    },
    onError: (error) => {
      toast(error.message, "error");
    },
  });

  return (
    <ListPageCardShell
      authorHref={`/scholars/${helpPost.author.id}`}
      authorName={helpPost.author.name || "Scholar"}
      authorId={helpPost.author.id}
      isFollowing={isFollowing}
      currentUserId={currentUserId}
      authorHandle={helpPost.author.handle || undefined}
      authorAvatarUrl={helpPost.author.avatarUrl || undefined}
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
        helpPost.updatedAt > helpPost.createdAt ? helpPost.updatedAt : undefined
      }
      footerVoteButton={
        <VoteButton
          targetId={helpPost.id}
          type="help"
          initialUpvotes={upvoteCount}
          initialDownvotes={downvoteCount}
          initialUserVote={userVote}
        />
      }
      footerCommentsHref={`/help/${helpPost.id}`}
      footerCommentsCount={helpPost._count.comments}
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
