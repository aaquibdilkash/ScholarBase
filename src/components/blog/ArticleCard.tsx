"use client";
import { Article, ArticleLike, User } from "@prisma/client";
import { LikeButton } from "@/components/interactions/LikeButton";
import ListPageCardShell from "@/components/cards/ListPageCardShell";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";
import { deleteArticle } from "@/app/actions/blog";

type ArticleWithDetails = Article & {
  author: User & {
    followers?: { followerId: string }[];
  };
  likes: ArticleLike[];
  _count: {
    likes: number;
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
  return (
    <ListPageCardShell
      authorHref={`/scholar/${article.authorId}`}
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
      footerLikeButton={
        <LikeButton
          targetId={article.id}
          type="article"
          initialLikes={article._count.likes}
          initialIsLiked={!!article.likes?.length}
        />
      }
      footerCommentsHref={`/blog/${article.slug}`}
      footerCommentsCount={article._count.comments}
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
