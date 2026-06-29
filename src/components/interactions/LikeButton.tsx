"use client";

import { toggleLike } from "@/app/actions/interactions";
import { useTransition } from "react";

export function LikeButton({
  targetId,
  type,
  initialLikes,
}: {
  targetId: string;
  type: "article" | "post";
  initialLikes: number;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      disabled={isPending}
      onClick={() => startTransition(() => toggleLike(targetId, type))}
      className="text-sm font-medium hover:text-blue-600 transition"
    >
      {isPending ? "..." : `❤️ ${initialLikes}`}
    </button>
  );
}
