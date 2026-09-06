"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { VoteButton } from "@/components/interactions/VoteButton";
import ListPageCardShell from "@/components/cards/ListPageCardShell";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";
import { ReportMenu } from "@/components/cards/ReportMenu";
import { deleteSocialPost } from "@/app/actions/feed";
import { renderMentionContent } from "@/components/interactions/MentionComposer";
import { ImageLightbox } from "@/components/ui/ImageLightbox";
import type { SocialPostWithAuthor as PostWithDetails } from "@/types/cards";

// Native CSS line clamp: clips only at whole lines so text is never sliced
// mid-line by a rigid pixel-height `overflow: hidden` container.
const lineClampStyle = (lines: number): React.CSSProperties => ({
  display: "-webkit-box",
  WebkitLineClamp: lines,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
});

// Fixed minimum height (px) for the collapsed card body, so every card renders a
// uniform rectangle regardless of text length or image aspect ratio.
const COLLAPSED_MIN_HEIGHT = 100;

export function SocialPostCard({
  post,
  currentUserId,
}: {
  post: PostWithDetails;
  currentUserId?: string;
}) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { toast } = useToast();
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);
  // Height of the collapsed preview box. It is a fixed minimum so every card
  // renders a uniform rectangle regardless of text length or image aspect ratio.
  const [collapsedBodyHeight, setCollapsedBodyHeight] = useState<number>(
    COLLAPSED_MIN_HEIGHT,
  );
  // How many text lines fit inside the collapsed preview box. Dynamic so the
  // text always fills the box height (no "cut with empty space below").
  const [maxLines, setMaxLines] = useState(3);
  // Intrinsic dimensions of the full-size image, used to detect whether the
  // thumbnail actually cuts off the bottom of the image.
  const [imageNatural, setImageNatural] = useState<{ w: number; h: number } | null>(
    null,
  );
  const [thumbnailWidth, setThumbnailWidth] = useState(0);
  const bodyRef = useRef<HTMLParagraphElement>(null);
  const measureRef = useRef<HTMLParagraphElement>(null);
  const imageButtonRef = useRef<HTMLButtonElement>(null);
  const isOwner = currentUserId === post.authorId;
  const isFollowing = (post.author?.followers?.length ?? 0) > 0;
  const userVote: "UPVOTE" | "DOWNVOTE" | null = Array.isArray(post.votes)
    ? (post.votes[0]?.voteType ?? null)
    : null;

  // A single image uses the legacy `imageUrl`; future multi-image posts can
  // prepend `imageUrls` here and the lightbox renders a navigable gallery.
  const lightboxImages = [post.imageUrl].filter(
    (url): url is string => Boolean(url),
  );

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

  // Compute (a) how many text lines fit in the fixed collapsed box, so text never
  // looks "cut while there is still empty space below it", and (b) whether the
  // full text exceeds that capacity (real truncation -> show toggle).
  const updateCollapsedMetrics = useCallback(() => {
    const body = bodyRef.current;
    const measure = measureRef.current;
    if (!body || !measure) {
      setIsTruncated(false);
      return;
    }
    const lineHeightPx =
      parseFloat(getComputedStyle(body).lineHeight) || 0;
    const lines = lineHeightPx > 0
      ? Math.max(1, Math.floor(COLLAPSED_MIN_HEIGHT / lineHeightPx))
      : 3;
    setMaxLines(lines);
    setCollapsedBodyHeight(COLLAPSED_MIN_HEIGHT);
    // Truncation is when the non-clamped text is taller than the visible box.
    setIsTruncated(
      measure.getBoundingClientRect().height >
        COLLAPSED_MIN_HEIGHT + 1,
    );
  }, []);

  useEffect(() => {
    updateCollapsedMetrics();
    const observer = new ResizeObserver(updateCollapsedMetrics);
    if (bodyRef.current) observer.observe(bodyRef.current);
    if (measureRef.current) observer.observe(measureRef.current);
    return () => observer.disconnect();
  }, [post.content, post.mentions, post.imageUrl, updateCollapsedMetrics]);

  // Track the image thumbnail width so we can compute the full-size image's
  // natural height at that width (to detect when it is cropped). Refs must not
  // be read during render, so the width lives in state, kept fresh by an
  // observer.
  useEffect(() => {
    const el = imageButtonRef.current;
    if (!el) return;
    const updateWidth = () => setThumbnailWidth(el.clientWidth);
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(el);
    return () => observer.disconnect();
  }, [post.imageUrl]);

  // The image's natural height at the thumbnail's width. If this exceeds the
  // collapsed box height, the image is being cropped from the bottom -> show
  // "View more" so the user can reveal the rest.
  const fullImageHeight =
    imageNatural && thumbnailWidth > 0
      ? thumbnailWidth * (imageNatural.h / imageNatural.w)
      : 0;
  const imageIsCut = !isExpanded && fullImageHeight > collapsedBodyHeight + 1;
  const showToggle = isExpanded || isTruncated || imageIsCut;

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
              if (response?.success && response.data) {
                const deletedPost = response.data;
                queryClient.setQueriesData<PostWithDetails[]>(
                  { queryKey: ["feed"] },
                  (oldData = []) =>
                    oldData.filter((item) => item.id !== deletedPost.id),
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
        post.editedAt && post.editedAt > post.createdAt
          ? post.editedAt
          : undefined
      }
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
        <ReportMenu
          entityId={post.id}
          entityType="POST"
          module="SOCIAL_FEED"
          ownerId={post.author?.id ?? post.authorId ?? null}
          currentUserId={currentUserId ?? null}
          isFrozen={post.isFrozen ?? false}
          hasActiveAppeal={post.hasActiveAppeal ?? false}
        />
      }
      // The text + image are a two-column row; the card wraps this row in its
      // own <Link> (so clicks here navigate), but the expansion toggle and the
      // lightbox button are siblings OUTSIDE that Link so they never navigate.
      noBodyLink={true}
      constrainBody={false}
    >
      <Link
        href={`/feed/${post.id}`}
        className={`flex min-w-0 gap-4 ${post.imageUrl ? "items-start" : ""}`}
        style={
          isExpanded
            ? undefined
            : { minHeight: collapsedBodyHeight }
        }
      >
        <div className={post.imageUrl ? "w-1/2 min-w-0" : "w-full"}>
          <div className="relative min-w-0 w-full">
            <p
              ref={bodyRef}
              className={`mb-4 whitespace-pre-wrap break-words leading-relaxed text-slate-800 transition-colors group-hover:text-slate-600 ${
                isExpanded ? "" : "overflow-hidden"
              }`}
              style={isExpanded ? undefined : lineClampStyle(maxLines)}
            >
              {renderedContent}
            </p>
            {/* Hidden, non-clamped copy used purely for truncation measurement. It must
                  share the body's exact text-layout classes so it wraps/breaks
                  identically and gives an accurate height comparison. */}
            <p
              ref={measureRef}
              inert
              aria-hidden="true"
              className="pointer-events-none absolute left-0 top-0 w-full whitespace-pre-wrap break-words leading-relaxed"
              style={{ visibility: "hidden" }}
            >
              {renderedContent}
            </p>
          </div>
        </div>
        {post.imageUrl && (
          <button
            ref={imageButtonRef}
            type="button"
            aria-label="Open image preview"
            className="mb-4 w-1/2 self-start cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-white p-0 text-left transition hover:opacity-90 dark:bg-slate-900"
            style={
              !isExpanded ? { height: collapsedBodyHeight } : undefined
            }
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              e.nativeEvent?.stopImmediatePropagation();
              setOpenIndex(0);
            }}
          >
            <Image
              src={post.imageUrl}
              alt=""
              width={800}
              height={400}
              unoptimized
              onLoad={(e) => {
                const el = e.currentTarget;
                if (el.naturalWidth && el.naturalHeight) {
                  setImageNatural({ w: el.naturalWidth, h: el.naturalHeight });
                }
              }}
              // Natural aspect ratio (`w-full h-auto`), so the image is never
              // distorted. Any part taller than the box is cut off from the
              // bottom only, hinting there is more -> "View more".
              className="block w-full h-auto transition duration-200 hover:scale-[1.02]"
            />
          </button>
        )}
      </Link>

      {showToggle && (
        <button
          type="button"
          onClick={(e) => {
            // This button sits OUTSIDE the <Link>, so it never navigates; this
            // also guards against any parent <Link>/wrapper bubbling.
            e.preventDefault();
            e.stopPropagation();
            setIsExpanded((current) => !current);
          }}
          className="mt-3 inline-flex text-sm font-semibold text-blue-700 transition hover:text-blue-800 hover:underline dark:text-blue-300 dark:hover:text-blue-200"
        >
          {isExpanded ? "View less" : "View more"}
        </button>
      )}

      {openIndex !== null && (
        <ImageLightbox
          images={lightboxImages}
          index={openIndex}
          onClose={() => setOpenIndex(null)}
          onNavigate={(idx) => setOpenIndex(idx)}
        />
      )}
    </ListPageCardShell>
  );
}
