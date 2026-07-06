"use client";

import { useState, useTransition } from "react";
import { toggleCommentLike } from "@/app/actions/comments";

export function CommentLikeButton({
  commentId,
  type,
  initialLikes,
}: {
  commentId: string;
  type: "article" | "post";
  initialLikes: number;
}) {
  const [likes, setLikes] = useState(initialLikes);
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          setLikes((current) => current + 1);
          try {
            await toggleCommentLike(commentId, type);
          } catch {
            setLikes((current) => Math.max(0, current - 1));
          }
        })
      }
      className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:border-blue-200 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
    >
      <span aria-hidden="true">♡</span>
      <span>{likes}</span>
    </button>
  );
}
