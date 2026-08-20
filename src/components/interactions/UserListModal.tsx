"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { getFollowers, getFollowing, toggleFollow } from "@/app/actions/follow";
import { useToast } from "@/components/ui/Toast";

import { X } from "lucide-react";

type UserItem = {
  id: string;
  name: string | null;
  handle: string | null;
  avatarUrl: string | null;
  isFollowing: boolean;
};

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
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [, startTransition] = useTransition();
  const { toast } = useToast();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      dialog.showModal();
      setLoading(true);
      const fetcher = mode === "followers" ? getFollowers : getFollowing;
      fetcher(userId, currentUserId)
        .then(setUsers)
        .catch(() => toast("Failed to load users.", "error"))
        .finally(() => setLoading(false));
    } else {
      dialog.close();
    }
  }, [open, userId, mode, currentUserId, toast]);

  const handleClose = () => {
    dialogRef.current?.close();
    onClose();
  };

  const handleFollow = (targetId: string) => {
    startTransition(async () => {
      try {
        const result = await toggleFollow(targetId);
        if (result.error) {
          toast(result.error, "error");
          return
        };
        if (result.success) {
          setUsers((prev) =>
            prev.map((u) =>
              u.id === targetId ? { ...u, isFollowing: !u.isFollowing } : u,
            ),
          );
        }
      } catch {
        toast("Failed to update.", "error");
      }
    });
  };

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 m-auto max-h-[80vh] rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl backdrop:bg-black/40 max-w-md w-full"
      onClose={handleClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) handleClose();
      }}
    >
      <div className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
          <button
            onClick={handleClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
          </div>
        ) : users.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">
            No users found.
          </p>
        ) : (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {users.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between gap-3 rounded-xl p-3 hover:bg-slate-50 transition"
              >
                <Link
                  href={`/scholars/${u.id}`}
                  className="flex items-center gap-3 min-w-0"
                  onClick={handleClose}
                >
                  <div className="h-10 w-10 shrink-0 rounded-full bg-slate-100 border flex items-center justify-center overflow-hidden">
                    {u.avatarUrl ? (
                      <Image
                        src={u.avatarUrl}
                        alt=""
                        width={40}
                        height={40}
                        unoptimized
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-sm font-bold text-slate-400">
                        {u.name?.charAt(0).toUpperCase() || "?"}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {u.name || "Scholar"}
                    </p>
                    {u.handle && (
                      <p className="truncate text-xs text-slate-500">
                        @{u.handle}
                      </p>
                    )}
                  </div>
                </Link>
                {currentUserId && currentUserId !== u.id && (
                  <button
                    onClick={() => handleFollow(u.id)}
                    className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                      u.isFollowing
                        ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        : "bg-blue-600 text-white hover:bg-blue-700"
                    }`}
                  >
                    {u.isFollowing ? "Following" : "Follow"}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </dialog>
  );
}
