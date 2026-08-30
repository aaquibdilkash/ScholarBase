"use client";

import Image from "next/image";
import { useQueryClient } from "@tanstack/react-query";
import { VoteButton } from "@/components/interactions/VoteButton";
import ListPageCardShell from "@/components/cards/ListPageCardShell";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";
import { ReportMenu } from "@/components/cards/ReportMenu";
import { deleteSocialPost } from "@/app/actions/feed";
import type { SocialPostWithAuthor as PostWithDetails } from "@/types/cards";

export function SocialPostCard({
  post,
  currentUserId,
}: {
  post: PostWithDetails;
  currentUserId?: string;
}) {
  const queryClient = useQueryClient();
  const isOwner = currentUserId === post.authorId;
  const isFollowing = (post.author?.followers?.length ?? 0) > 0;
  const userVote: "UPVOTE" | "DOWNVOTE" | null =
    Array.isArray(post.votes) ? post.votes[0]?.voteType ?? null : null;

  return (
    <ListPageCardShell
      authorId={post.authorId}
      isFollowing={isFollowing}
      currentUserId={currentUserId}
      authorHref={`/scholars/${post.authorId}`}
      authorName={post.author?.name || "Scholar"}
      authorHandle={post.author?.handle || undefined}
      authorAvatarUrl={post.author?.avatarUrl || undefined}
      detailPageHref={`/feed/${post.id}`}
      managementControls={
        isOwner && (
          <OwnerActionsDropdown
            editHref={`/feed/${post.id}/edit`}
            isOwner={true}
            editLabel="Edit Post"
            deleteLabel="Delete"
            onDelete={async () => {
              const response = await deleteSocialPost(post.id);
              if (response?.success) {
                queryClient.setQueriesData<PostWithDetails[]>(
                  { queryKey: ["feed"] },
                  (oldData = []) =>
                    oldData.filter((item) => item.id !== response.data.id),
                );
              }
              return { refresh: false };
            }}
          />
        )
      }
      createdDate={post.createdAt}
      editedDate={post.editedAt && post.editedAt > post.createdAt ? post.editedAt : undefined}
      footerVoteButton={
        <VoteButton
          frozen={post.isFrozen === true}
          targetId={post.id}
          module="SOCIAL_POST"
          initialTotalVotes={post.totalVotes ?? 0}
          initialUserVote={userVote}
        />
      }
      footerCommentsHref={`/feed/${post.id}`}
      footerCommentsCount={post.totalComments ?? 0}
      footerReportMenu={
        <ReportMenu entityId={post.id} entityType="POST" module="SOCIAL_FEED" contentType="feed" />
      }
    >
      <div className={`flex gap-4 ${post.imageUrl ? "items-start" : ""}`}>
        <p
          className={`mb-4 whitespace-pre-wrap break-words leading-relaxed text-slate-800 transition-colors group-hover:text-slate-600 ${
            post.imageUrl ? "w-1/2 min-w-0" : "w-full"
          }`}
        >
          {post.content}
        </p>
        {post.imageUrl && (
          <div className="mb-4 w-1/2 self-start overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:opacity-90 dark:bg-slate-900">
            <Image
              src={post.imageUrl}
              alt=""
              width={800}
              height={400}
              unoptimized
              className="block h-auto w-full object-contain"
            />
          </div>
        )}
      </div>
    </ListPageCardShell>
  );
}
