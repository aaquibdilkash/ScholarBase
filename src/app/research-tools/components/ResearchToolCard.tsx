"use client";

import { ResearchTool, User } from "@prisma/client";
import ListPageCardShell from "@/components/cards/ListPageCardShell";
import { LikeButton } from "@/components/interactions/LikeButton";

type ResearchToolWithAuthor = ResearchTool & {
  author: User;
  isLiked: boolean;
  _count: { likes: number; comments: number };
};

export function ResearchToolCard({ tool }: { tool: ResearchToolWithAuthor }) {
  return (
    <ListPageCardShell
      authorHref={`/scholar/${tool.author.id}`}
      authorName={tool.author.name || "Scholar"}
      authorHandle={tool.author.handle || undefined}
      authorAvatarUrl={tool.author.avatarUrl || undefined}
      detailPageHref={`/research-tools/${tool.id}`}
      footerLikeButton={
        <LikeButton
          targetId={tool.id}
          type="researchTool"
          initialLikes={tool._count.likes}
          initialIsLiked={tool.isLiked}
        />
      }
      footerCommentsHref={`/research-tools/${tool.id}`}
      footerCommentsCount={tool._count.comments}
    >
      <h2 className="mb-2 text-lg font-semibold leading-tight text-slate-950 group-hover:text-blue-700 transition-colors">
        {tool.name}
      </h2>
      <p className="text-sm leading-relaxed text-slate-600 line-clamp-3">
        {tool.description}
      </p>

      {tool.website && (
        <a
          href={tool.website}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="mt-6 block rounded-lg bg-slate-950 py-2 text-center text-xs font-semibold text-white transition-colors duration-200 hover:bg-slate-800"
        >
          Visit Tool
        </a>
      )}
    </ListPageCardShell>
  );
}
