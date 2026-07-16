import prisma from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { requireCurrentUser } from "@/lib/auth";
import { updateSocialPost } from "@/app/actions/feed";

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireCurrentUser(
    "You must be logged in to edit this post.",
  );

  // Fetch only what is needed for the form
  const post = await prisma.socialPost.findUnique({
    where: { id },
    select: {
      id: true,
      content: true,
      authorId: true,
    },
  });

  if (!post) {
    notFound();
  }

  // Security Guard
  if (post.authorId !== user.id) {
    throw new Error("You are not authorized to edit this post.");
  }

  // Define the update action cleanly outside the JSX
  async function handleUpdate(formData: FormData) {
    "use server";
    await updateSocialPost(formData, post!.id);
  }

  return (
    <main className="mx-auto max-w-2xl py-12 px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <Link
          href={`/feed/${post.id}`}
          className="mb-6 inline-flex items-center text-sm font-medium text-slate-500 transition-colors hover:text-blue-700"
        >
          ← Cancel and Back to Post
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
          Edit Post
        </h1>
      </div>

      <form
        action={handleUpdate}
        className="sb-surface-strong p-6 md:p-8 flex flex-col gap-4"
      >
        <div>
          <label className="sb-label mb-2 block">Post Content</label>
          <textarea
            name="content"
            defaultValue={post.content}
            required
            rows={6}
            className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-slate-900 resize-y"
            placeholder="What's on your mind?"
          />
        </div>
        <div className="flex justify-end pt-2">
          <button type="submit" className="sb-button-accent">
            Save Changes
          </button>
        </div>
      </form>
    </main>
  );
}
