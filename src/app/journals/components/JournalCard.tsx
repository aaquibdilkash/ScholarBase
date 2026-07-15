"use client";

import { Journal, User } from "@prisma/client";
import Link from "next/link";
import Image from "next/image";
import { TrendingItemFooter } from "@/components/feed/TrendingItemFooter";
import { ClockIcon } from "@/components/icons/ClockIcon";

type JournalWithAuthor = Journal & {
  author: User;
  isLiked: boolean;
  _count: { likes: number; comments: number };
};

export function JournalCard({ journal }: { journal: JournalWithAuthor }) {
  return (
    <div key={journal.id} className="sb-card sb-card-hover group flex flex-col">
      <div className="flex items-center gap-3 mb-4">
        <Link href={`/scholar/${journal.author.id}`} className="shrink-0">
          <div className="w-10 h-10 rounded-full bg-slate-100 border flex items-center justify-center overflow-hidden hover:ring-2 hover:ring-blue-100 transition">
            {journal.author.avatarUrl ? (
              <Image
                src={journal.author.avatarUrl}
                alt="Author"
                width={40}
                height={40}
                unoptimized
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="font-semibold text-slate-400 text-base">
                {journal.author.name?.charAt(0).toUpperCase() || "?"}
              </span>
            )}
          </div>
        </Link>
        <div>
          <Link
            href={`/scholar/${journal.author.id}`}
            className="font-semibold text-slate-950 text-sm hover:text-blue-700 hover:underline transition"
          >
            {journal.author.name || "Scholar"}
          </Link>
          <div className="mt-0.5 text-xs font-medium text-slate-500">
            @{journal.author.handle}
          </div>
        </div>
      </div>

      <Link href={`/journals/${journal.id}`} className="flex-grow">
        <h2 className="mb-2 text-lg font-semibold leading-tight text-slate-950">
          {journal.title}
        </h2>

        <p className="text-sm leading-relaxed text-slate-600 line-clamp-3">
          {journal.about}
        </p>
      </Link>

      <div className="mt-auto border-t border-slate-100 pt-4">
        {journal.issn && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-blue-100/50 bg-blue-50/50 p-2 text-xs font-semibold text-blue-600">
            ISSN: {journal.issn}
          </div>
        )}
        <TrendingItemFooter item={{ ...journal, type: "journal" }} />
      </div>
    </div>
  );
}
