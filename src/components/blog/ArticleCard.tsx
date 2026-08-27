"use client";
import { VoteButton } from "@/components/interactions/VoteButton";
import ListPageCardShell from "@/components/cards/ListPageCardShell";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";
import { deleteArticle } from "@/app/actions/blog";
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
  const isFollowing = (article.author?.followers?.length ?? 0) > 0;

  // The 'votes' prop is now a filtered select returning an array with 0 or 1 elements.
  const initialUserVote = article.votes && article.votes.length > 0 ? article.votes[0].voteType : null;

  const deleteMutation = useMutation({
    mutationFn: deleteArticle,
    onSuccess: (response) => {
      if (!response.success || !response.data) {
        toast({ title: "Error", description: "Failed to delete article.", variant: "destructive" });
        return;
      }
      queryClient.setQueryData<ArticleWithAuthor[]>(
        ["articles", { q: "" }],
        (oldData = []) =>
          oldData.filter((p) => p.id !== response.data?.deletedId),
      );
      toast({ title: "Success", description: "Article deleted successfully." });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  return (
    <ListPageCardShell
      authorHref={`/scholars/${article.authorId}`}
      authorName={article.author?.name || "Scholar"}
      authorId={article.authorId}
      isFollowing={isFollowing}
      currentUserId={currentUserId}
      authorHandle={article.author?.handle || undefined}
      authorAvatarUrl={article.author?.avatarUrl || undefined}
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
          module="ARTICLE"
          initialTotalVotes={article.totalVotes}
          initialUserVote={initialUserVote}
        />
      }
      footerCommentsHref={`/blog/${article.slug}`}
      footerCommentsCount={article.totalComments}
      createdDate={article.createdAt}
      editedDate={
        article.editedAt && article.editedAt > article.createdAt ? article.editedAt : undefined
      }
    >
      <h2 className="mb-2 text-xl font-semibold leading-tight text-slate-950 group-hover:text-blue-700 transition-colors dark:text-white dark:group-hover:text-blue-300">
        {article.title}
      </h2>
      <p className="text-sm leading-relaxed text-slate-900 dark:text-white line-clamp-3">
        {article.excerpt}
      </p>
    </ListPageCardShell>
  );
}
