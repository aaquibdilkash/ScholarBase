import { getHelpPost } from "@/app/actions/help";
import { CommentSection } from "@/components/interactions/CommentSection";
import { getCurrentUser } from "@/lib/auth";
import { notFound } from "next/navigation";
import { VoteButton } from "@/components/interactions/VoteButton";
import { deleteHelpPost } from "@/app/actions/help";
import DetailPageCardShell from "@/components/cards/DetailPageCardShell";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";
import { RichContent } from "@/components/content/RichContent";

import { buildMetadata } from "@/lib/seo";
import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const post = await getHelpPost(id).catch(() => null);
  if (!post) return { title: "Help Post" };
  return buildMetadata({
    title: post.title,
    description: `Help request: ${post.subject || post.category || ""}. ${(post.message || "").replace(/<[^>]*>/g, " ")}`,
    path: `/help/${post.id}`,
    type: "article",
    publishedTime: post.createdAt,
    modifiedTime: post.updatedAt,
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
    notFound();
  }

  const userVote =
    (post.votes?.find((v) => v.userId === user?.id)?.voteType as
      | "UPVOTE"
      | "DOWNVOTE"
      | null) ?? null;

  // Define the delete action outside the JSX
  async function handleDelete() {
    "use server";
        await deleteHelpPost(post!.id);
    return { redirect: "/help" };
  }

  return (
    <DetailPageCardShell
      backHref="/help"
      backLabel="Back to Help & Support"
      authorHref={`/scholars/${post.author?.id}`}
      authorName={post.author?.name || "Scholar"}
      authorHandle={post.author?.handle || undefined}
      authorAvatarUrl={post.author?.avatarUrl || undefined}
      authorId={post.author?.id}
      isFollowing={!!post.author?.followers?.length}
      currentUserId={user?.id}
      createdDate={post.createdAt}
      editedDate={post.updatedAt > post.createdAt ? post.updatedAt : undefined}
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
        />
      }
      footerCommentsHref={`/help/${post.id}#comments`}
      footerCommentsCount={post.totalComments}
      discussion={
        <CommentSection
          comments={post.comments}
          totalComments={post.totalComments}
          targetId={post.id}
          module="help"
          currentUserId={user?.id ?? null}
          postAuthorId={post.author?.id}
        />
      }
    >
      <h1 className="text-lg sm:text-xl md:text-2xl font-bold mb-1.5 sm:mb-2">
        {post.title}
      </h1>

      <p className="text-sm sm:text-base font-semibold text-blue-700 mb-3 sm:mb-6">
        {post.category}
      </p>

      <p className="mb-4 text-sm sm:text-base text-slate-600 dark:text-slate-300">
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
