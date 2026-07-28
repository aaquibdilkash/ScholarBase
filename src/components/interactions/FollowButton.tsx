"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFollowContext } from "./FollowProvider";
import { useToast } from "@/components/ui/Toast";
import { useAuthModal } from "./AuthModal";
import { toggleFollow } from "@/app/actions/follow";

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
  const { toast } = useToast();
  const { openAuthModal } = useAuthModal();

  const isFollowingState = getFollowState(targetId, initialIsFollowing);
  const nextState = !isFollowingState;

  return (
    <button
      disabled={isPending}
      onClick={() => {
        setFollowState(targetId, nextState);

        startTransition(async () => {
          try {
            const result = await toggleFollow(targetId);
            if (typeof result === "object" && "error" in result) {
              setFollowState(targetId, initialIsFollowing);
              openAuthModal();
              return;
            }
            if (typeof result === "boolean") {
              setFollowState(targetId, result);
              toast(
                result
                  ? "Started following this scholar"
                  : "Unfollowed this scholar",
                "success",
              );
              return;
            }
            router.refresh();
          } catch {
            setFollowState(targetId, !nextState);
            toast("Failed to update follow status. Please try again.", "error");
            router.refresh();
          }
        });
      }}
      className={`px-6 py-2 text-sm font-semibold rounded-lg transition ${
        isFollowingState
          ? "bg-gray-100 text-gray-800 hover:bg-gray-200"
          : "bg-blue-600 text-white hover:bg-blue-700"
      }`}
    >
      {isPending ? (
        <span className="inline-flex items-center gap-2">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          {isFollowingState ? "Following..." : "Unfollowing..."}
        </span>
      ) : isFollowingState ? (
        "Following"
      ) : (
        "Follow"
      )}
    </button>
  );
}
