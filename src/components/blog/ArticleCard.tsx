"use client";
import { VoteButton } from "@/components/interactions/VoteButton";
import ListPageCardShell from "@/components/cards/ListPageCardShell";
import { ReportMenu } from "@/components/cards/ReportMenu";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";
import { deleteArticle } from "@/app/actions/blog";
import type { ArticleWithAuthor } from "@/types/cards";
import { useQueryClient } from "@tanstack/react-query";
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

  const initialUserVote = article.votes && article.votes.length > 0 ? article.votes[0].voteType : null;

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
            onDelete={async () => {
              try {
                const response = await deleteArticle(article.id);
                if (!response?.success || !response.data) {
                  toast({ title: "Error", description: "Failed to delete article.", variant: "destructive" });
                  return { refresh: false };
                }
                queryClient.setQueriesData<ArticleWithAuthor[]>(
                  { queryKey: ["articles", { q: "" }] },
                  (oldData = []) =>
                    oldData.filter((p) => p.id !== response.data?.deletedId),
                );
                toast({ title: "Success", description: "Article deleted successfully." });
                return { refresh: false };
              } catch (error) {
                const message = error instanceof Error ? error.message : "Unknown error";
                toast({ title: "Error", description: message, variant: "destructive" });
                return { refresh: false };
              }
            }}
          />
        )
      }
      footerVoteButton={
        <VoteButton
          frozen={article.isFrozen === true}
          targetId={article.id}
          module="ARTICLE"
          initialTotalVotes={article.totalVotes}
          initialUserVote={initialUserVote}
        />
      }
      footerCommentsHref={`/blog/${article.slug}`}
      footerCommentsCount={article.totalComments}
      footerReportMenu={
        <ReportMenu entityId={article.id} entityType="POST" module="ARTICLE_PAGE" />
      }
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
