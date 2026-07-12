"use client";

import { toggleLike } from "@/app/actions/interactions";
import { useState, useTransition } from "react";

import { HeartIcon } from "../icons/HeartIcon";

export function LikeButton({
  targetId,
  type,
  initialLikes,
  initialIsLiked,
}: {
  targetId: string;
  type: "article" | "post" | "vacancy" | "admission" | "event" | "supervisor" | "recommendation";
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
      <HeartIcon filled={isLiked} /> {likeCount}
    </button>
  );
}
