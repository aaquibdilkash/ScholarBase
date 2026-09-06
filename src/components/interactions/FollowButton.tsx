"use client";

import { useOptimistic, useTransition, useState, useEffect } from "react";
import { useToast } from "@/components/ui/Toast";
import { useAuthModal } from "./AuthModal";
import { toggleFollow } from "@/app/actions/follow";
import { Loader2 } from "lucide-react";
import { getFollowState, setFollowStateForUser, subscribeFollowState } from "@/lib/follow-store";

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

  const [followState, setFollowState] = useState(initialIsFollowing);

  const [optimisticIsFollowing, setOptimisticIsFollowing] = useOptimistic(
    followState,
    (state) => !state,
  );

  useEffect(() => {
    const globalState = getFollowState();
    if (targetId in globalState) {
      setFollowState(globalState[targetId]);
    }

    const unsubscribe = subscribeFollowState((globalState) => {
      if (targetId in globalState) {
        setFollowState(globalState[targetId]);
      }
    });
    return unsubscribe;
  }, [targetId]);

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
        setFollowState(result.isFollowing);
        setFollowStateForUser(targetId, result.isFollowing);
        toast(
          result.isFollowing
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
          ? "bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
          : "bg-slate-950 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
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
