"use client";

import { HelpPost, User } from "@prisma/client";
import Link from "next/link";
import Image from "next/image";
import { TrendingItemFooter } from "@/components/feed/TrendingItemFooter";

type HelpPostWithAuthor = HelpPost & {
  author: User;
  isLiked: boolean;
  _count: { likes: number; comments: number };
};

export function HelpPostCard({
  helpPost,
}: {
  helpPost: HelpPostWithAuthor;
}) {
  return (
    <div
      key={helpPost.id}
      className="sb-card sb-card-hover group flex flex-col"
    >
      <div className="flex items-center gap-3 mb-4">
        <Link href={`/scholar/${helpPost.author.id}`} className="shrink-0">
          <div className="w-10 h-10 rounded-full bg-slate-100 border flex items-center justify-center overflow-hidden hover:ring-2 hover:ring-blue-100 transition">
            {helpPost.author.avatarUrl ? (
              <Image
                src={helpPost.author.avatarUrl}
                alt="Author"
                width={40}
                height={40}
                unoptimized
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="font-semibold text-slate-400 text-base">
                {helpPost.author.name?.charAt(0).toUpperCase() || "?"}
              </span>
            )}
          </div>
        </Link>
        <div>
          <Link
            href={`/scholar/${helpPost.author.id}`}
            className="font-semibold text-slate-950 text-sm hover:text-blue-700 hover:underline transition"
          >
            {helpPost.author.name || "Scholar"}
          </Link>
          <div className="mt-0.5 text-xs font-medium text-slate-500">
            @{helpPost.author.handle}
          </div>
        </div>
      </div>

      <Link href={`/help/${helpPost.id}`} className="flex-grow">
        <div className="mb-4">
          <h2 className="text-lg font-semibold leading-tight text-slate-950">
            {helpPost.title}
          </h2>
          <p className="mt-1 text-sm font-semibold text-blue-700">
            {helpPost.category}
          </p>
        </div>

        <p className="mb-6 text-sm leading-relaxed text-slate-600 line-clamp-4">
          {helpPost.message}
        </p>
      </Link>

      <div className="mt-auto border-t border-slate-100 pt-4">
        <TrendingItemFooter
          item={{
            id: helpPost.id,
            type: "help",
            isLiked: helpPost.isLiked,
            _count: helpPost._count,
          }}
        />
      </div>
    </div>
  );
}
