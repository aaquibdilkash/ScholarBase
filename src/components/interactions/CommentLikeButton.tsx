"use client";

import { useState, useTransition } from "react";
import { toggleCommentLike } from "@/app/actions/comments";

const EmptyHeart = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="feather feather-heart"
  >
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
);

const FilledHeart = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="currentColor"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="feather feather-heart"
  >
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
);

export function CommentLikeButton({
  commentId,
  type,
  initialLikes,
  initialIsLiked,
}: {
  commentId: string;
  type:
    | "article"
    | "post"
    | "vacancy"
    | "admission"
    | "event"
    | "supervisor"
    | "recommendation"
    | "help"
    | "researchTool"
    | "journal";
  initialLikes: number;
  initialIsLiked: boolean;
}) {
  const [isLiked, setIsLiked] = useState(initialIsLiked);
  const [likeCount, setLikeCount] = useState(initialLikes);
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const prevIsLiked = isLiked;
          const prevLikeCount = likeCount;

          const nextIsLiked = !prevIsLiked;

          // optimistic
          setIsLiked(nextIsLiked);
          setLikeCount((c) => c + (nextIsLiked ? 1 : -1));

          try {
            const res = await toggleCommentLike(commentId, type);
            setIsLiked(res.isLiked);
            setLikeCount(res.likeCount);
          } catch {
            // revert
            setIsLiked(prevIsLiked);
            setLikeCount(prevLikeCount);
          }
        })
      }
      className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-black-500 transition hover:border-blue-200 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {isLiked ? <FilledHeart /> : <EmptyHeart />}
      <span>{likeCount}</span>
    </button>
  );
}
