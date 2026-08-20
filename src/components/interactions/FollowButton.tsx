"use client";

import { useOptimistic, useTransition } from "react";
import { useToast } from "@/components/ui/Toast";
import { useAuthModal } from "./AuthModal";
import { toggleFollow } from "@/app/actions/follow";
import { Loader2 } from "lucide-react";

export function FollowButton({
  targetId,
  isFollowing: initialIsFollowing,
  currentUserId,
}: {
  targetId: string;
  isFollowing: boolean;
  currentUserId?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const { openAuthModal } = useAuthModal();

  const [optimisticIsFollowing, setOptimisticIsFollowing] = useOptimistic(
    initialIsFollowing,
    (state) => !state
  );

  // A user cannot follow themselves, so hide the button entirely.
  if (currentUserId && currentUserId === targetId) {
    return null;
  }

  const handleClick = async () => {
    if (!currentUserId) {
      openAuthModal();
      return;
    }

    startTransition(async () => {
      setOptimisticIsFollowing(!optimisticIsFollowing);
      const result = await toggleFollow(targetId);

      if (result.error) {
        toast(result.error, "error");
      } else if (result.success) {
        toast(
          optimisticIsFollowing
            ? "Started following this scholar"
            : "Unfollowed this scholar",
          "success",
        );
      }
    });
  };

  return (
    <button
      disabled={isPending}
      onClick={handleClick}
      className={`px-6 py-2 text-sm font-semibold rounded-lg transition ${
        optimisticIsFollowing
          ? "bg-gray-100 text-gray-800 hover:bg-gray-200"
          : "bg-slate-950 text-white hover:bg-slate-800"
      }`}
    >
      {isPending ? (
        <span className="inline-flex items-center gap-2">
          <Loader2 className="animate-spin h-4 w-4" />
          {optimisticIsFollowing ? "Following..." : "Unfollowing..."}
        </span>
      ) : optimisticIsFollowing ? (
        "Following"
      ) : (
        "Follow"
      )}
    </button>
  );
}
