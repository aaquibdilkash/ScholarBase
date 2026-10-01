"use client";

import { useState } from "react";
import { UserListModal } from "@/components/interactions/UserListModal";

export function FollowerCount({
  followerCount,
  followingCount,
  profileId,
  currentUserId,
}: {
  followerCount: number;
  followingCount: number;
  profileId: string;
  currentUserId?: string;
}) {
  const [modalMode, setModalMode] = useState<"followers" | "following" | null>(
    null,
  );

  return (
    <>
      <button
        onClick={() => setModalMode("followers")}
        className="font-semibold transition hover:text-blue-700 hover:underline dark:hover:text-blue-300"
      >
        {followerCount} {followerCount === 1 ? "follower" : "followers"}
      </button>
      <span className="text-slate-300 dark:text-slate-600">·</span>
      <button
        onClick={() => setModalMode("following")}
        className="font-semibold transition hover:text-blue-700 hover:underline dark:hover:text-blue-300"
      >
        {followingCount} following
      </button>

      {/*
        Mounted unconditionally and driven by `open`, NOT rendered
        conditionally.

        `AppendMoreList` fetches page 1 only when `reloadToken` *changes*. A
        conditionally-mounted copy would come into existence already holding
        `"<id>:<mode>"`, the change-check would see no change, and the list would
        render empty forever with nothing to scroll. Keeping it mounted means
        the token goes null -> "<id>:<mode>" on open, which is what actually
        kicks off the fetch.
      */}
      <UserListModal
        open={modalMode !== null}
        onClose={() => setModalMode(null)}
        title={modalMode === "following" ? "Following" : "Followers"}
        userId={profileId}
        mode={modalMode ?? "followers"}
        currentUserId={currentUserId}
      />
    </>
  );
}