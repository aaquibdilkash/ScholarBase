"use client";

import { toggleLike } from "@/app/actions/interactions";
import { useState, useTransition } from "react";

const EmptyHeart = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="feather feather-heart"
  >
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
  </svg>
);

const FilledHeart = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="currentColor"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="feather feather-heart"
  >
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
  </svg>
);

export function LikeButton({
  targetId,
  type,
  initialLikes,
  initialIsLiked,
}: {
  targetId: string;
  type: "article" | "post";
  initialLikes: number;
  initialIsLiked: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [isLiked, setIsLiked] = useState(initialIsLiked);
  const [likeCount, setLikeCount] = useState(initialLikes);

  const handleClick = () => {
    startTransition(async () => {
      // Optimistic update
      setIsLiked(!isLiked);
      setLikeCount(likeCount + (!isLiked ? 1 : -1));

      const result = await toggleLike(targetId, type);
      setIsLiked(result);
      // We don't need to set the like count again from the server
      // as the optimistic update should be correct.
      // However, if we wanted to, we would need the server to return the new count.
    });
  };

  return (
    <button
      disabled={isPending}
      onClick={handleClick}
      className="text-sm font-medium hover:text-blue-600 transition flex items-center gap-2"
    >
      {isLiked ? <FilledHeart /> : <EmptyHeart />} {likeCount}
    </button>
  );
}
