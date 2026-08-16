import type { Metadata } from "next";
import { buildNoindexMetadata } from "@/lib/seo";

export const metadata: Metadata = buildNoindexMetadata("Edit Help Post - ScholarBase");
import prisma from "@/lib/db";
import { notFound } from "next/navigation";
import { requireCurrentUser } from "@/lib/auth";
import HelpPostForm from "@/components/help/HelpPostForm";
import CreateOrEditPageShell from "@/components/layout/CreateOrEditPageShell";

export default async function EditHelpPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireCurrentUser(
    "You must be logged in to edit this post.",
  );

  // Fetch only the raw field data required to populate the form inputs
  const post = await prisma.helpPost.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      category: true,
      subject: true,
      message: true,
      authorId: true,
    },
  });

  if (!post) {
    notFound();
  }

  // Security Guard: Ensure the current user owns this post
  if (post.authorId !== user.id) {
    throw new Error("You are not authorized to edit this post.");
  }

  return (
    <CreateOrEditPageShell
      title="Edit Help Post"
      description="Update your question, category, or message details."
      backHref={`/help/${post.id}`}
      backLabel="← Cancel and Back to Post"
    >
      <HelpPostForm
        mode="edit"
        helpPostId={post.id}
        initialValues={{
          title: post.title,
          category: post.category,
          subject: post.subject,
          message: post.message,
        }}
      />
    </CreateOrEditPageShell>
  );
}
