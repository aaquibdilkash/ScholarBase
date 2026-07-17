import prisma from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

import DetailPageCardShell from "@/components/cards/DetailPageCardShell";
import { LikeButton } from "@/components/interactions/LikeButton";
import { CommentSection } from "@/components/interactions/CommentSection";
import { getCurrentUser } from "@/lib/auth";
import { deleteSocialPost } from "@/app/actions/feed";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";

export default async function SinglePostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();

  const post = await prisma.socialPost.findUnique({
    where: { id },
    select: {
      id: true,
      content: true,
      createdAt: true,
      authorId: true,
      author: {
        select: {
          id: true,
          name: true,
          handle: true,
          avatarUrl: true,
        },
      },
      likes: {
        where: { userId: user?.id },
        select: { userId: true },
      },
      comments: {
        where: { parentId: null },
        select: {
          id: true,
          content: true,
          createdAt: true,
          parentId: true,
          author: {
            select: { id: true, name: true, avatarUrl: true },
          },
          likes: {
            where: { userId: user?.id },
            select: { userId: true },
          },
          replies: {
            select: {
              id: true,
              content: true,
              createdAt: true,
              parentId: true,
              author: {
                select: { id: true, name: true, avatarUrl: true },
              },
              likes: {
                where: { userId: user?.id },
                select: { userId: true },
              },
              _count: { select: { likes: true } },
            },
            orderBy: { createdAt: "asc" },
          },
          _count: { select: { likes: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      _count: {
        select: { likes: true, comments: true },
      },
    },
  });

  if (!post) notFound();

  const p = post;

  async function handleDelete() {
    "use server";
    await deleteSocialPost(p.id);
  }

  return (
    <DetailPageCardShell
      backHref="/feed"
      backLabel="Back to Feed"
      authorHref={`/scholar/${p.author.id}`}
      authorName={p.author.name || "Scholar"}
      authorHandle={p.author.handle || undefined}
      authorAvatarUrl={p.author.avatarUrl || undefined}
      managementControls={
        user?.id === p.authorId ? (
          <OwnerActionsDropdown
            editHref={`/feed/${p.id}/edit`}
            onDelete={handleDelete}
            isOwner={true}
            editLabel="Edit Post"
            deleteLabel="Delete"
          />
        ) : null
      }
      footerLikeButton={
        <LikeButton
          targetId={p.id}
          type="post"
          initialLikes={p._count.likes}
          initialIsLiked={!!p.likes?.length}
        />
      }
      footerCommentsHref={`/feed/${p.id}#comments`}
      footerCommentsCount={p._count.comments}
      discussion={
        <div className="mt-12" id="comments">
          <h2 className="text-2xl font-bold text-slate-950 mb-6">Discussion</h2>
          <CommentSection
            comments={p.comments}
            targetId={p.id}
            type="post"
            currentUserId={user?.id ?? null}
          />
        </div>
      }
    >
      <p className="text-xl whitespace-pre-wrap leading-relaxed text-slate-800">
        {p.content}
      </p>

      <div className="mt-4 text-sm font-medium text-slate-500">
        {new Intl.DateTimeFormat("en-US", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        }).format(p.createdAt)}
      </div>
    </DetailPageCardShell>
  );
}
