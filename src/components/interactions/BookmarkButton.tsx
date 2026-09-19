"use client";

import { toggleBookmark } from "@/app/actions/bookmarks";
import { useAuthModal } from "@/components/interactions/AuthModal";
import { useToast } from "@/components/ui/Toast";
import { useUser } from "@/hooks/useUser";
import { type ModuleKey } from "@/lib/transactions";
import { Bookmark, Loader2 } from "lucide-react";
import { useOptimistic, useState, useTransition } from "react";

type BookmarkState = {
  totalBookmarks: number;
  isBookmarked: boolean;
};

function applyBookmarkChange(state: BookmarkState, _next: boolean): BookmarkState {
  void _next;
  return {
    isBookmarked: !state.isBookmarked,
    totalBookmarks: state.totalBookmarks + (state.isBookmarked ? -1 : 1),
  };
}

export function BookmarkButton({
  targetId,
  module,
  initialTotalBookmarks,
  initialIsBookmarked,
  frozen = false,
}: {
  targetId: string;
  module: ModuleKey;
  initialTotalBookmarks: number;
  initialIsBookmarked: boolean;
  frozen?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [nonOptimisticState, setNonOptimisticState] = useState<BookmarkState>({
    totalBookmarks: initialTotalBookmarks,
    isBookmarked: initialIsBookmarked,
  });
  const [optimisticState, setOptimisticState] = useOptimistic(
    nonOptimisticState,
    applyBookmarkChange,
  );
  const { toast } = useToast();
  const { openAuthModal } = useAuthModal();
  const { user } = useUser();

  const handleBookmark = () => {
    if (!user) {
      openAuthModal();
      return;
    }

    if (frozen) {
      toast({
        title: "Frozen by moderators",
        description:
          "Bookmarking is disabled while this content is under moderation.",
        variant: "destructive",
      });
      return;
    }

    startTransition(async () => {
      setOptimisticState(true);
      const result = await toggleBookmark(targetId, module);

      if (result.success && result.data) {
        setNonOptimisticState({
          totalBookmarks: result.data.totalBookmarks,
          isBookmarked: result.data.isBookmarked,
        });
        toast({
          title: result.data.isBookmarked ? "Bookmarked" : "Bookmark removed",
          description: result.data.isBookmarked
            ? "Saved to your bookmarks."
            : "Removed from your bookmarks.",
        });
      } else {
        toast({
          title: "Error",
          description:
            (result && !result.success && result.error) ||
            "Failed to update bookmark. Please try again.",
          variant: "destructive",
        });
      }
    });
  };

  const { totalBookmarks, isBookmarked } = optimisticState;

  return (
    <button
      type="button"
      disabled={isPending || frozen}
      onClick={handleBookmark}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-70 ${
        isBookmarked
          ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300"
          : "border-slate-200 bg-white text-slate-500 hover:border-blue-300 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400 dark:hover:border-blue-800 dark:hover:text-blue-300"
      }`}
      title={isBookmarked ? "Remove bookmark" : "Bookmark"}
      aria-pressed={isBookmarked}
    >
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Bookmark
          className="h-4 w-4"
          fill={isBookmarked ? "currentColor" : "none"}
        />
      )}
      <span>{Math.max(0, totalBookmarks)}</span>
    </button>
  );
}
