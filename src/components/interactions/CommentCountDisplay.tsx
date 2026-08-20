"use client";

import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { useCommentCount } from "@/lib/comment-count-store";

export default function CommentCountDisplay({
  href,
  initialCount,
}: {
  href: string;
  initialCount: number;
}) {
  const count = useCommentCount(initialCount);

  return (
    <Link
      href={href}
      className="flex items-center gap-2 text-sm font-semibold text-slate-600 transition-colors hover:text-blue-700 dark:text-slate-400 dark:hover:text-blue-300"
    >
      <MessageCircle className="w-5 h-5" />
      {count}{" "}
      <span className="hidden md:inline">
        {count === 1 ? "Comment" : "Comments"}
      </span>
    </Link>
  );
}
