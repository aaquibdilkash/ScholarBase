import { createSocialPost } from "./actions";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import { LikeButton } from "@/components/interactions/LikeButton";
import { CommentSection } from "@/components/interactions/CommentSection";
import Link from "next/link";

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const isFollowingTab = tab === "following";
  let posts;

  if (isFollowingTab) {
    const following = await prisma.follows.findMany({
      where: { followerId: user.id },
      select: { followingId: true },
    });
    const followingIds = following.map((f) => f.followingId);
    posts = await prisma.socialPost.findMany({
      where: { authorId: { in: followingIds } },
      include: {
        author: true,
        likes: true,
        comments: {
          where: { parentId: null },
          include: { author: true, replies: { include: { author: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  } else {
    posts = await prisma.socialPost.findMany({
      include: {
        author: true,
        likes: true,
        comments: {
          where: { parentId: null },
          include: { author: true, replies: { include: { author: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  return (
    <main className="max-w-2xl mx-auto py-10 px-4">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-8">
        Scholar Feed
      </h1>

      {/* Tab Navigation as Clean Pills */}
      <div className="flex gap-2 mb-8 bg-slate-100 p-1.5 rounded-2xl w-fit">
        <Link
          href="/feed"
          className={`px-6 py-2 rounded-xl font-semibold transition-all ${!isFollowingTab ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"}`}
        >
          All Posts
        </Link>
        <Link
          href="/feed?tab=following"
          className={`px-6 py-2 rounded-xl font-semibold transition-all ${isFollowingTab ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"}`}
        >
          Following
        </Link>
      </div>

      {/* Post Creation Box */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200/60 mb-10">
        <form action={createSocialPost} className="flex flex-col gap-4">
          <textarea
            name="content"
            placeholder="What are you researching today?"
            className="w-full resize-none border-none focus:ring-0 p-2 text-slate-800 bg-transparent placeholder:text-slate-400 text-lg"
            rows={3}
            required
          />
          <div className="flex justify-end border-t border-slate-100 pt-4">
            <button
              type="submit"
              className="px-6 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all hover:shadow-lg hover:shadow-blue-600/20"
            >
              Post Update
            </button>
          </div>
        </form>
      </div>

      {/* Feed Items */}
      <div className="flex flex-col gap-6">
        {posts.map((post) => (
          <div
            key={post.id}
            className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200/60 transition-all hover:border-slate-300"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center font-bold text-blue-700 text-lg">
                {post.author.name?.charAt(0) || "?"}
              </div>
              <div>
                <Link
                  href={`/scholar/${post.authorId}`}
                  className="font-bold text-slate-900 hover:text-blue-600 transition"
                >
                  {post.author.name || "Scholar"}
                </Link>
                <div className="text-xs text-slate-400 font-medium">
                  {new Date(post.createdAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "numeric",
                  })}
                </div>
              </div>
            </div>

            <p className="text-slate-700 whitespace-pre-wrap mb-6 leading-relaxed">
              {post.content}
            </p>

            <div className="pt-4 border-t border-slate-100 flex items-center gap-6">
              <LikeButton
                targetId={post.id}
                type="post"
                initialLikes={post.likes.length}
              />
              <div className="text-sm font-semibold text-slate-400">
                {post.comments.length} Comments
              </div>
            </div>
            <div className="mt-4">
              <CommentSection
                comments={post.comments}
                targetId={post.id}
                type="post"
              />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
