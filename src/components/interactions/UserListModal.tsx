"use client";

import { useEffect, useRef, useTransition, useCallback } from "react";
import Link from "next/link";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { getFollowersWithCursor, getFollowingWithCursor, toggleFollow } from "@/app/actions/follow";
import { useToast } from "@/components/ui/Toast";
import { AppendMoreList } from "@/components/layout/AppendMoreList";
import type { CursorPage } from "@/components/layout/listPage";

import { X } from "lucide-react";

type UserItem = {
  id: string;
  name: string | null;
  handle: string | null;
  avatarUrl: string | null;
  isFollowing: boolean;
};

const PAGE_SIZE = 10;
// Stable identity so the internal re-seed effect does not fire every render.
const EMPTY_USERS: UserItem[] = [];

export function UserListModal({
  open,
  onClose,
  title,
  userId,
  mode,
  currentUserId,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  userId: string;
  mode: "followers" | "following";
  currentUserId?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [, startTransition] = useTransition();
  const { toast } = useToast();

  const fetcher = mode === "followers" ? getFollowersWithCursor : getFollowingWithCursor;
  // These endpoints paginate on `createdAt` and return an explicit `nextCursor`
  // under a `users` key, so map the result into the shared CursorPage shape.
  const fetchPage = useCallback(
    async (cursor?: string): Promise<CursorPage<UserItem>> => {
      const result = await fetcher(
        userId,
        currentUserId,
        PAGE_SIZE,
        cursor,
      );
      return {
        items: result.users as UserItem[],
        nextCursor: result.nextCursor,
        hasMore: result.hasMore,
      };
    },
    [fetcher, userId, currentUserId],
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [open]);

  const handleClose = () => {
    dialogRef.current?.close();
    onClose();
  };

  const handleFollow = (targetId: string, updateItem: (id: string, patch: Partial<UserItem>) => void) => {
    startTransition(async () => {
      try {
        const result = await toggleFollow(targetId);
        if (result.error) {
          toast(result.error, "error");
          return;
        };
        if (result.success) {
          updateItem(targetId, { isFollowing: result.isFollowing });
        }
      } catch {
        toast("Failed to update.", "error");
      }
    });
  };

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 m-auto max-h-[80vh] rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl backdrop:bg-black/40 max-w-md w-full dark:border-slate-700 dark:bg-slate-900"
      onClose={handleClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) handleClose();
      }}
    >
      <div className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-950 dark:text-slate-50">{title}</h2>
          <button
            onClick={handleClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <AppendMoreList<UserItem>
          initialItems={EMPTY_USERS}
          loadMore={fetchPage}
          chunkSize={PAGE_SIZE}
          // Re-fetch page 1 each time the dialog opens.
          reloadToken={open ? `${userId}:${mode}` : null}
          onLoadError={(error) => {
            console.error(`Failed to load ${mode}:`, error);
            toast(`Failed to load ${mode.toLowerCase()}.`, "error");
          }}
          className="max-h-[60vh] space-y-3 overflow-y-auto"
          emptyState={
            <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
              No users found.
            </p>
          }
          loadingIndicator={
            <div className="flex items-center justify-center gap-2 py-4 text-slate-500">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600 dark:border-slate-700 dark:border-t-blue-400" />
              Loading more...
            </div>
          }
          renderItem={(u, { updateItem }) => (
            <div
              key={u.id}
              className="flex items-center justify-between gap-3 rounded-xl p-3 hover:bg-slate-50 transition dark:hover:bg-slate-800/60"
            >
              <Link
                href={`/scholars/${u.id}`}
                prefetch={false}
                className="flex items-center gap-3 min-w-0"
                onClick={handleClose}
              >
                <div className="h-10 w-10 shrink-0 rounded-full bg-slate-100 border flex items-center justify-center overflow-hidden dark:border-slate-700 dark:bg-slate-800">
                  {u.avatarUrl ? (
                    <UserAvatar src={u.avatarUrl} name={u.name} />
                  ) : (
                    <span className="text-sm font-bold text-slate-400 dark:text-slate-500">
                      {u.name?.charAt(0).toUpperCase() || "?"}
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {u.name || "Scholar"}
                  </p>
                  {u.handle && (
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                      @{u.handle}
                    </p>
                  )}
                </div>
              </Link>
              {currentUserId && currentUserId !== u.id && (
                <button
                  onClick={() => handleFollow(u.id, updateItem)}
                  className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                    u.isFollowing
                      ? "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:ring-1 dark:ring-slate-600 dark:hover:bg-slate-700"
                      : "bg-blue-600 text-white hover:bg-blue-700"
                  }`}
                >
                  {u.isFollowing ? "Following" : "Follow"}
                </button>
              )}
            </div>
          )}
        />
      </div>
    </dialog>
  );
}
