import prisma from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { requireCurrentUser } from "@/lib/auth";
import HelpPostForm from "@/app/help/components/HelpPostForm";

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
    <main className="mx-auto max-w-4xl py-6 px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <Link
          href={`/help/${post.id}`}
          className="mb-6 inline-flex items-center text-sm font-medium text-slate-500 transition-colors hover:text-blue-700"
        >
          ← Cancel and Back to Post
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
          Edit Help Post
        </h1>
        <p className="mt-2 text-slate-600">
          Update your question, category, or message details.
        </p>
      </div>

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
    </main>
  );
}
