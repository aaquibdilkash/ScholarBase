"use client";
import { Article, User, VoteType } from "@prisma/client";
import { VoteButton } from "@/components/interactions/VoteButton";
import ListPageCardShell from "@/components/cards/ListPageCardShell";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";
import { deleteArticle } from "@/app/actions/blog";

type ArticleWithDetails = Article & {
  author: User & {
    followers?: { followerId: string }[];
  };
  votes: {
    userId: string;
    voteType: VoteType;
  }[];
  _count: {
    comments: number;
  };
};

export function ArticleCard({
  article,
  currentUserId,
}: {
  article: ArticleWithDetails;
  currentUserId?: string;
}) {
  const isOwner = currentUserId === article.authorId;
  const isFollowing = (article.author.followers?.length ?? 0) > 0;

  const initialUpvotes = article.votes.filter(
    (v) => v.voteType === "UPVOTE"
  ).length;
  const initialDownvotes = article.votes.filter(
    (v) => v.voteType === "DOWNVOTE"
  ).length;
  const initialUserVote =
    article.votes.find((v) => v.userId === currentUserId)?.voteType ?? null;

  return (
    <ListPageCardShell
      authorHref={`/scholars/${article.authorId}`}
      authorName={article.author.name || "Scholar"}
      authorId={article.authorId}
      isFollowing={isFollowing}
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
            onDelete={async () => {
              await deleteArticle(article.id, article.slug);
            }}
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
