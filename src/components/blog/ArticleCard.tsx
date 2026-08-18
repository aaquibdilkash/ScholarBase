"use client";
import { VoteButton } from "@/components/interactions/VoteButton";
import ListPageCardShell from "@/components/cards/ListPageCardShell";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";
import { deleteArticleSafe } from "@/app/actions/blog";
import type { ArticleWithAuthor } from "@/types/cards";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/Toast";

export function ArticleCard({
  article,
  currentUserId,
}: {
  article: ArticleWithAuthor;
  currentUserId?: string;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isOwner = currentUserId === article.authorId;
  const isFollowing = (article.author.followers?.length ?? 0) > 0;

  const initialUpvotes = article.votes.filter(
    (v) => v.voteType === "UPVOTE",
  ).length;
  const initialDownvotes = article.votes.filter(
    (v) => v.voteType === "DOWNVOTE",
  ).length;
  const initialUserVote =
    article.votes.find((v) => v.userId === currentUserId)?.voteType ?? null;

  const deleteMutation = useMutation({
    mutationFn: deleteArticleSafe,
    onSuccess: (response) => {
      if (!response.success || !response.data) {
        toast(response.error || "Failed to delete article.", "error");
        return;
      }
      queryClient.setQueryData<ArticleWithAuthor[]>(
        ["articles", { q: "" }],
        (oldData = []) =>
          oldData.filter((p) => p.id !== response.data?.deletedId),
      );
      toast("Article deleted successfully.", "success");
    },
    onError: (error) => {
      toast(error.message, "error");
    },
  });

  return (
    <ListPageCardShell
      authorHref={`/scholars/${article.authorId}`}
      authorName={article.author.name || "Scholar"}
      authorId={article.authorId}
      isFollowing={isFollowing}
      currentUserId={currentUserId}
      authorHandle={article.author.handle || undefined}
      authorAvatarUrl={article.author.avatarUrl || undefined}
      detailPageHref={`/blog/${article.slug}`}
      managementControls={
        isOwner && (
          <OwnerActionsDropdown
            editHref={`/blog/${article.slug}/edit`}
            isOwner={true}
            editLabel="Edit Article"
            deleteLabel="Delete"
            onDelete={() => { deleteMutation.mutate(article.id); return { refresh: false }; }}
          />
        )
      }
      footerVoteButton={
        <VoteButton
          targetId={article.id}
          type="article"
          initialUpvotes={initialUpvotes}
          initialDownvotes={initialDownvotes}
          initialUserVote={initialUserVote}
        />
      }
      footerCommentsHref={`/blog/${article.slug}`}
      footerCommentsCount={article._count.comments}
      createdDate={article.createdAt}
      editedDate={
        article.updatedAt > article.createdAt ? article.updatedAt : undefined
      }
    >
      <h2 className="mb-2 text-xl font-semibold leading-tight text-slate-950 group-hover:text-blue-700 transition-colors">
        {article.title}
      </h2>
      <p className="text-sm leading-relaxed text-slate-600 line-clamp-3">
        {article.excerpt}
      </p>
    </ListPageCardShell>
  );
}
