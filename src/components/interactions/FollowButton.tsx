"use client";

import { toggleFollow } from "@/app/actions/follow"; // Ensure this exists
import { useTransition } from "react";

export function FollowButton({
  targetId,
  isFollowing,
}: {
  targetId: string;
  isFollowing: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      disabled={isPending}
      onClick={() => startTransition(() => toggleFollow(targetId))}
      className={`px-6 py-2 text-sm font-semibold rounded-full transition ${
        isFollowing
          ? "bg-gray-100 text-gray-800 hover:bg-gray-200"
          : "bg-blue-600 text-white hover:bg-blue-700"
      }`}
    >
      {isPending ? "..." : isFollowing ? "Following" : "Follow"}
    </button>
  );
}
