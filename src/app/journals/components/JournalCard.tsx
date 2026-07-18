"use client";

import { Journal, User } from "@prisma/client";
import ListPageCardShell from "@/components/cards/ListPageCardShell";
import { LikeButton } from "@/components/interactions/LikeButton";

type JournalWithAuthor = Journal & {
  author: User;
  isLiked: boolean;
  _count: { likes: number; comments: number };
};

export function JournalCard({ journal }: { journal: JournalWithAuthor }) {
  return (
    <ListPageCardShell
      authorHref={`/scholar/${journal.author.id}`}
      authorName={journal.author.name || "Scholar"}
      authorHandle={journal.author.handle || undefined}
      authorAvatarUrl={journal.author.avatarUrl || undefined}
      detailPageHref={`/journals/${journal.id}`}
      footerLikeButton={
        <LikeButton
          targetId={journal.id}
          type="journal"
          initialLikes={journal._count.likes}
          initialIsLiked={journal.isLiked}
        />
      }
      footerCommentsHref={`/journals/${journal.id}`}
      footerCommentsCount={journal._count.comments}
    >
      <h2 className="mb-2 text-lg font-semibold leading-tight text-slate-950 group-hover:text-blue-700 transition-colors">
        {journal.title}
      </h2>

      <p className="text-sm leading-relaxed text-slate-600 line-clamp-3">
        {journal.about}
      </p>

      {journal.issn && (
        <div className="mt-6 rounded-xl border border-blue-100/50 bg-blue-50/50 p-2 text-xs font-semibold text-blue-600">
          ISSN: {journal.issn}
        </div>
      )}
    </ListPageCardShell>
  );
}
