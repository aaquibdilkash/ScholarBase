import { getHelpPost } from "@/app/actions/help";
import { CommentSection } from "@/components/interactions/CommentSection";
import { getCurrentUser } from "@/lib/auth";
import { notFound } from "next/navigation";
import { VoteButton } from "@/components/interactions/VoteButton";
import { BookmarkButton } from "@/components/interactions/BookmarkButton";
import { deleteHelpPost } from "@/app/actions/help";
import DetailPageCardShell from "@/components/cards/DetailPageCardShell";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  buildBreadcrumbList,
  buildContentJsonLd,
  CONTENT_SCHEMA,
} from "@/lib/schema";
import { ReportMenu } from "@/components/cards/ReportMenu";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";
import { RichContent } from "@/components/content/RichContent";

import { buildMetadata, buildNoindexMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import RelatedContent from "@/components/content/RelatedContent";
import { getRelatedContent } from "@/lib/semantic/related";
import { getModeratorDeletedContent } from "@/lib/deleted-content";
import { RemovedContentNotice } from "@/components/moderation/RemovedContentNotice";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const post = await getHelpPost(id).catch(() => null);
  if (!post) {
    return buildNoindexMetadata("Removed content");
  }
  return buildMetadata({
    title: post.title,
    description: `Help request: ${post.subject || post.category || ""}. ${(post.message || "").replace(/<[^>]*>/g, " ")}`,
    path: `/help/${post.id}`,
    type: "article",
    publishedTime: post.createdAt,
    modifiedTime: post.editedAt,
    section: "Help & Support",
  });
}

export default async function HelpPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  const post = await getHelpPost(id, user?.id);

  if (!post) {
    const removed = await getModeratorDeletedContent("help", { id });
    if (!removed) notFound();
    return (
      <RemovedContentNotice
        backHref="/help"
        backLabel="Back to Help & Support"
        entityId={removed.id}
        module="HELP_POST"
        ownerId={removed.authorId}
        currentUserId={user?.id}
        hasActiveAppeal={removed.hasActiveAppeal}
        noun="help post"
      />
    );
  }

  const userVote =
    (post.votes?.[0]?.voteType as "UPVOTE" | "DOWNVOTE" | null) ?? null;

  const related = await getRelatedContent("HELP_POST", post.id);

  // Define the delete action outside the JSX
  async function handleDelete() {
    "use server";
    const res = await deleteHelpPost(post!.id);
    if (res?.success === false) return res;
    return { redirect: "/help", invalidateQueries: [["helpPosts"]] };
  }

  return (
    <DetailPageCardShell
      structuredData={
        <JsonLd
          data={[
            buildContentJsonLd({
              type: CONTENT_SCHEMA.helpPost,
              path: `/help/${post.id}`,
              name: post.title,
              description: post.message,
              author: {
                name: post.author?.name,
                path: post.author?.id ? `/scholars/${post.author.id}` : null,
              },
              datePublished: post.createdAt,
              dateModified: post.editedAt,
              extra: { about: post.subject },
            }),
            buildBreadcrumbList([
              { name: "Help", path: "/help" },
              { name: post.title, path: `/help/${post.id}` },
            ]),
          ]}
        />
      }
      relatedContent={
        <RelatedContent title="Related help posts" items={related} />
      }
      isFrozen={post.isFrozen ?? false}
      frozenEntityId={post.id}
      frozenModule="HELP_POST"
      frozenEntityType="POST"
      frozenOwnerId={post.author?.id ?? null}
      frozenHasActiveAppeal={post.hasActiveAppeal ?? false}
      backHref="/help"
      backLabel="Back to Help & Support"
      authorHref={`/scholars/${post.author?.id}`}
      authorName={post.author?.name || "Scholar"}
      authorHandle={post.author?.handle || undefined}
      authorAvatarUrl={post.author?.avatarUrl || undefined}
      authorVerified={!!post.author?.institutionVerifiedAt}
      authorId={post.author?.id}
      isFollowing={!!post.author?.followers?.length}
      currentUserId={user?.id}
      createdDate={post.createdAt}
      editedDate={
        post.editedAt && post.editedAt > post.createdAt
          ? post.editedAt
          : undefined
      }
      managementControls={
        user?.id === post.author?.id ? (
          <OwnerActionsDropdown
            editHref={`/help/${post.id}/edit`}
            onDelete={handleDelete}
            isOwner={true}
            editLabel="Edit Post"
            deleteLabel="Delete"
          />
        ) : null
      }
      footerVoteButton={
        <VoteButton
          targetId={post.id}
          module="HELP_POST"
          initialTotalVotes={post.totalVotes}
          initialUserVote={userVote}
          isOwnContent={user?.id === post.author?.id}
        />
      }
      footerBookmarkButton={
        <BookmarkButton
          frozen={post.isFrozen === true}
          targetId={post.id}
          module="HELP_POST"
          initialTotalBookmarks={post.totalBookmarks ?? 0}
          initialIsBookmarked={
            Array.isArray(post.bookmarks) && post.bookmarks.length > 0
          }
        />
      }
      footerCommentsHref={`/help/${post.id}#comments`}
      footerCommentsCount={post.totalComments}
      footerReportMenu={
        <ReportMenu
          entityId={post.id}
          entityType="POST"
          module="HELP_POST"
          ownerId={post.author?.id ?? null}
          currentUserId={user?.id ?? null}
          isFrozen={post.isFrozen}
          hasActiveAppeal={post.hasActiveAppeal}
        />
      }
      discussion={
        <CommentSection
          locked={post.isFrozen ?? false}
          comments={post.comments}
          totalComments={post.totalComments}
          targetId={post.id}
          module="help"
          currentUserId={user?.id ?? null}
          postAuthorId={post.author?.id}
        />
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
          {post.category}
        </span>
      </div>
      <h1 className="min-w-0 max-w-full break-words text-lg sm:text-xl md:text-2xl font-bold mb-1.5 sm:mb-2 [overflow-wrap:anywhere]">
        {post.title}
      </h1>

      <p className="break-words mb-4 text-sm sm:text-base text-slate-600 dark:text-slate-300">
        <span className="font-semibold text-slate-800 dark:text-slate-100">
          Subject:
        </span>{" "}
        {post.subject}
      </p>

      <RichContent
        content={post.message}
        className="text-slate-700 leading-relaxed mb-4 sm:mb-6 md:mb-8"
      />
    </DetailPageCardShell>
  );
}
