"use client";

import { toggleFollow } from "@/app/actions/follow";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFollowContext } from "./FollowProvider";

export function FollowButton({
  targetId,
  isFollowing: initialIsFollowing,
}: {
  targetId: string;
  isFollowing: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { getFollowState, setFollowState } = useFollowContext();

  const isFollowingState = getFollowState(targetId, initialIsFollowing);
  const nextState = !isFollowingState;

  return (
    <button
      disabled={isPending}
      onClick={() => {
        // Optimistic UI update so label changes immediately across all cards.
        setFollowState(targetId, nextState);

        startTransition(async () => {
          try {
            const result = await toggleFollow(targetId);
            // If server returns a boolean, trust it.
            if (typeof result === "boolean") {
              setFollowState(targetId, result);
              return;
            }
            // Otherwise, force a server re-fetch so the label matches DB.
            router.refresh();
          } catch {
            // Avoid reverting to a potentially stale prop value.
            setFollowState(targetId, !nextState);
            router.refresh();
          }
        });
      }}
      className={`px-6 py-2 text-sm font-semibold rounded-full transition ${
        isFollowingState
          ? "bg-gray-100 text-gray-800 hover:bg-gray-200"
          : "bg-blue-600 text-white hover:bg-blue-700"
      }`}
    >
      {isPending ? "..." : isFollowingState ? "Following" : "Follow"}
    </button>
  );
}
