"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { VoteButton } from "@/components/interactions/VoteButton";
import { BookmarkButton } from "@/components/interactions/BookmarkButton";
import ListPageCardShell from "@/components/cards/ListPageCardShell";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";
import { ReportMenu } from "@/components/cards/ReportMenu";
import { CollapsibleMediaBody } from "@/components/cards/CollapsibleMediaBody";
import { deleteSocialPost } from "@/app/actions/feed";
import { removeFromList } from "@/utils/cacheMutation";
import { renderMentionContent } from "@/components/interactions/MentionComposer";
import type { SocialPostWithAuthor as PostWithDetails } from "@/types/cards";

export function SocialPostCard({
  post,
  currentUserId,
  priority = false,
}: {
  post: PostWithDetails;
  currentUserId?: string;
  priority?: boolean;
}) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { toast } = useToast();
  const isOwner = currentUserId === post.authorId;
  const isFollowing = (post.author?.followers?.length ?? 0) > 0;
  const userVote: "UPVOTE" | "DOWNVOTE" | null = Array.isArray(post.votes)
    ? post.votes[0]?.voteType ?? null
    : null;

  const renderedContent = renderMentionContent(
    post.content ?? "",
    post.mentions,
    {
      renderAsLink: false,
      onMentionClick: (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.nativeEvent?.stopImmediatePropagation();
        const mentionId = (e.currentTarget as HTMLElement).dataset?.mentionId;
        if (mentionId) router.push(`/scholars/${mentionId}`);
      },
    },
  );

  return (
    <ListPageCardShell
      authorId={post.authorId}
      isFollowing={isFollowing}
      currentUserId={currentUserId}
      authorHref={`/scholars/${post.authorId}`}
      authorName={post.author?.name || "Scholar"}
      authorHandle={post.author?.handle || undefined}
      authorAvatarUrl={post.author?.avatarUrl || undefined} authorVerified={!!(post.author?.institutionVerifiedAt)}
      detailPageHref={`/feed/${post.id}`}
      // Without these the shell renders no frozen notice at all: the post looks
      // normal in the feed while its detail page says "frozen by moderators".
      isFrozen={post.isFrozen ?? false}
      frozenEntityId={post.id}
      frozenModule="SOCIAL_FEED"
      frozenEntityType="POST"
      frozenOwnerId={post.author?.id ?? null}
      frozenHasActiveAppeal={post.hasActiveAppeal ?? false}
      // Share payload: mirror feed/[id]/page.tsx generateMetadata() — the
      // first 58 chars of the post body.
      shareTitle={(post.content ?? "").replace(/\s+/g, " ").trim().slice(0, 58) || "Scholar Post"}
      shareText={(post.content ?? "").replace(/\s+/g, " ").trim()}
      managementControls={
        isOwner && (
          <OwnerActionsDropdown
            editHref={`/feed/${post.id}/edit`}
            isOwner={true}
            editLabel="Edit Post"
            deleteLabel="Delete"
            onDelete={async () => {
              const response = await deleteSocialPost(post.id);
              if (response?.success && response.data) {
                removeFromList<PostWithDetails>(
                  queryClient,
                  ["feed"],
                  response.data.id,
                );
                toast("Post deleted successfully.", "success");
              }
              return { refresh: false };
            }}
          />
        )
      }
      createdDate={post.createdAt}
      editedDate={
        post.editedAt && post.editedAt > post.createdAt ? post.editedAt : undefined
      }
      footerVoteButton={(
        <VoteButton
          frozen={post.isFrozen === true}
          targetId={post.id}
          module="SOCIAL_POST"
          initialTotalVotes={post.totalVotes ?? 0}
          initialUserVote={userVote}
          isOwnContent={isOwner}
        />
      )}
      footerBookmarkButton={(
        <BookmarkButton
          frozen={post.isFrozen === true}
          targetId={post.id}
          module="SOCIAL_POST"
          initialTotalBookmarks={post.totalBookmarks ?? 0}
          initialIsBookmarked={Array.isArray(post.bookmarks) && post.bookmarks.length > 0}
        />
      )}
      footerCommentsHref={`/feed/${post.id}`}
      footerCommentsCount={post.totalComments ?? 0}
      footerReportMenu={(
        <ReportMenu
          entityId={post.id}
          entityType="POST"
          module="SOCIAL_FEED"
          ownerId={post.author?.id ?? post.authorId ?? null}
          currentUserId={currentUserId ?? null}
          isFrozen={post.isFrozen ?? false}
          hasActiveAppeal={post.hasActiveAppeal ?? false}
        />
      )}
      // The text + image always stack. The card wraps this in its own <Link>
      // (so clicks here navigate), but the expansion toggle and the lightbox
      // button are siblings OUTSIDE that Link so they never navigate.
      noBodyLink={true}
      constrainBody={false}
    >
      {/* Text first, cover below, in both collapse states on every breakpoint. */}
      <CollapsibleMediaBody
        href={`/feed/${post.id}`}
        imageUrl={post.imageUrl}
        text={renderedContent}
        contentKey={`${post.content ?? ""}|${post.imageUrl ?? ""}`}
        priority={priority}
      />
    </ListPageCardShell>
  );
}
