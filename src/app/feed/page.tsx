import { createSocialPost } from "./actions"; // Adjust path if you moved this to /actions/feed.ts
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import { LikeButton } from "@/components/interactions/LikeButton";
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
  let followingIds: string[] = [];

  // If on the following tab, get the IDs first
  if (isFollowingTab) {
    const following = await prisma.follows.findMany({
      where: { followerId: user.id },
      select: { followingId: true },
    });
    followingIds = following.map((f) => f.followingId);
  }

  // Highly optimized query: Only fetch the post, author, likes, and the COUNT of comments
  const posts = await prisma.socialPost.findMany({
    where: isFollowingTab ? { authorId: { in: followingIds } } : undefined,
    include: {
      author: true,
      likes: true,
      _count: {
        select: { comments: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Helper to format dates cleanly
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  };

  return (
    <main className="max-w-2xl mx-auto py-10 px-4">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-8">
        Scholar Feed
      </h1>

      {/* Tab Navigation as Clean Pills */}
      <div className="flex gap-2 mb-8 bg-slate-100 p-1.5 rounded-2xl w-fit">
        <Link
          href="/feed"
          className={`px-6 py-2 rounded-xl font-semibold transition-all ${
            !isFollowingTab
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-900"
          }`}
        >
          All Posts
        </Link>
        <Link
          href="/feed?tab=following"
          className={`px-6 py-2 rounded-xl font-semibold transition-all ${
            isFollowingTab
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-900"
          }`}
        >
          Following
        </Link>
      </div>

      {/* Post Creation Box */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 mb-10">
        <form action={createSocialPost} className="flex flex-col gap-4">
          <textarea
            name="content"
            placeholder="What are you researching today?"
            className="w-full resize-none border-none focus:ring-0 p-2 text-slate-800 bg-transparent placeholder:text-slate-400 text-lg outline-none"
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

      {/* Sleek Feed Items */}
      <div className="flex flex-col gap-6">
        {posts.map((post) => (
          <article
            key={post.id}
            className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 transition-all hover:shadow-md hover:border-blue-200"
          >
            {/* Header: Author Info */}
            <div className="flex items-center gap-4 mb-4">
              <Link href={`/scholar/${post.authorId}`} className="shrink-0">
                <div className="w-12 h-12 rounded-full bg-slate-100 border flex items-center justify-center overflow-hidden hover:ring-2 hover:ring-blue-100 transition">
                  {post.author.avatarUrl ? (
                    <img
                      src={post.author.avatarUrl}
                      alt="Author"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="font-bold text-slate-400 text-lg">
                      {post.author.name?.charAt(0).toUpperCase() || "?"}
                    </span>
                  )}
                </div>
              </Link>
              <div>
                <Link
                  href={`/scholar/${post.authorId}`}
                  className="font-bold text-slate-900 hover:text-blue-600 hover:underline transition"
                >
                  {post.author.name || "Scholar"}
                </Link>
                <div className="text-xs text-slate-500 font-medium mt-0.5">
                  {post.author.handle && (
                    <span className="mr-2">@{post.author.handle}</span>
                  )}
                  <span>{formatDate(post.createdAt)}</span>
                </div>
              </div>
            </div>

            {/* Body: Clickable Post Content */}
            <Link href={`/feed/${post.id}`} className="block group">
              <p className="text-slate-800 whitespace-pre-wrap mb-4 leading-relaxed group-hover:text-slate-600 transition-colors">
                {post.content}
              </p>
            </Link>

            {/* Footer: Interactions */}
            <div className="pt-4 border-t border-slate-100 flex items-center gap-6">
              <LikeButton
                targetId={post.id}
                type="post"
                initialLikes={post.likes.length}
                // Optional: If LikeButton accepts a prop for whether current user liked it, pass it here!
              />

              <Link
                href={`/feed/${post.id}`}
                className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-blue-600 transition-colors"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
                {post._count.comments} Comments
              </Link>
            </div>
          </article>
        ))}

        {posts.length === 0 && (
          <div className="text-center py-12 bg-white rounded-3xl border border-slate-200 border-dashed">
            <p className="text-slate-500 font-medium">
              No posts to show right now.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
