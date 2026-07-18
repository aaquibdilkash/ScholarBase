"use client";

import { HelpPost, User } from "@prisma/client";
import ListPageCardShell from "@/components/cards/ListPageCardShell";
import { LikeButton } from "@/components/interactions/LikeButton";

type HelpPostWithAuthor = HelpPost & {
  author: User;
  isLiked: boolean;
  _count: { likes: number; comments: number };
};

export function HelpPostCard({ helpPost }: { helpPost: HelpPostWithAuthor }) {
  return (
    <ListPageCardShell
      authorHref={`/scholar/${helpPost.author.id}`}
      authorName={helpPost.author.name || "Scholar"}
      authorHandle={helpPost.author.handle || undefined}
      authorAvatarUrl={helpPost.author.avatarUrl || undefined}
      detailPageHref={`/help/${helpPost.id}`}
      footerLikeButton={
        <LikeButton
          targetId={helpPost.id}
          type="help"
          initialLikes={helpPost._count.likes}
          initialIsLiked={helpPost.isLiked}
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
      </div>

      <p className="text-sm leading-relaxed text-slate-600 line-clamp-4">
        {helpPost.message}
      </p>
    </ListPageCardShell>
  );
}
