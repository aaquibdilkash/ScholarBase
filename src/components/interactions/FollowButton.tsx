"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFollowContext } from "./FollowProvider";
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
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { getFollowState, setFollowState } = useFollowContext();
  const { toast } = useToast();
  const { openAuthModal } = useAuthModal();

  // A user cannot follow themselves, so hide the button entirely.
  if (currentUserId && currentUserId === targetId) {
    return null;
  }

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
          : "bg-slate-950 text-white hover:bg-slate-800"
      }`}
    >
      {isPending ? (
        <span className="inline-flex items-center gap-2">
          <Loader2 className="animate-spin h-4 w-4" />
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
