"use client";

import { ResearchTool, User } from "@prisma/client";
import Link from "next/link";
import Image from "next/image";
import { TrendingItemFooter } from "@/components/feed/TrendingItemFooter";

type ResearchToolWithAuthor = ResearchTool & {
  author: User;
  isLiked: boolean;
  _count: { likes: number; comments: number };
};

export function ResearchToolCard({ tool }: { tool: ResearchToolWithAuthor }) {
  return (
    <div key={tool.id} className="sb-card sb-card-hover group flex flex-col">
      <div className="flex items-center gap-3 mb-4">
        <Link href={`/scholar/${tool.author.id}`} className="shrink-0">
          <div className="w-10 h-10 rounded-full bg-slate-100 border flex items-center justify-center overflow-hidden hover:ring-2 hover:ring-blue-100 transition">
            {tool.author.avatarUrl ? (
              <Image
                src={tool.author.avatarUrl}
                alt="Author"
                width={40}
                height={40}
                unoptimized
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="font-semibold text-slate-400 text-base">
                {tool.author.name?.charAt(0).toUpperCase() || "?"}
              </span>
            )}
          </div>
        </Link>
        <div>
          <Link
            href={`/scholar/${tool.author.id}`}
            className="font-semibold text-slate-950 text-sm hover:text-blue-700 hover:underline transition"
          >
            {tool.author.name || "Scholar"}
          </Link>
          <div className="mt-0.5 text-xs font-medium text-slate-500">
            @{tool.author.handle}
          </div>
        </div>
      </div>

      <Link href={`/research-tools/${tool.id}`} className="flex-grow">
        <h2 className="mb-2 text-lg font-semibold leading-tight text-slate-950">
          {tool.name}
        </h2>
        <p className="text-sm leading-relaxed text-slate-600 line-clamp-3">
          {tool.description}
        </p>
      </Link>

      <div className="mt-auto border-t border-slate-100 pt-4">
        {tool.website && (
          <a
            href={tool.website}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 rounded-lg bg-slate-950 p-2 text-center text-xs font-semibold text-white transition-colors duration-200 hover:bg-slate-800"
          >
            Visit Tool
          </a>
        )}
        <div className="mt-4">
          <TrendingItemFooter item={{ ...tool, type: "researchTool" }} />
        </div>
      </div>
    </div>
  );
}
