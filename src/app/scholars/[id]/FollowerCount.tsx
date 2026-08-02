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

      {modalMode === "followers" && (
        <UserListModal
          open={true}
          onClose={() => setModalMode(null)}
          title="Followers"
          userId={profileId}
          mode="followers"
          currentUserId={currentUserId}
        />
      )}
      {modalMode === "following" && (
        <UserListModal
          open={true}
          onClose={() => setModalMode(null)}
          title="Following"
          userId={profileId}
          mode="following"
          currentUserId={currentUserId}
        />
      )}
    </>
  );
}