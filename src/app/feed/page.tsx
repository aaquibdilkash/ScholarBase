import { createSocialPost } from "@/app/actions/feed";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import { LikeButton } from "@/components/interactions/LikeButton";
import Link from "next/link";
import Image from "next/image";

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
    <main className="mx-auto max-w-3xl py-6">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
            Scholar Feed
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Short research updates from the community.
          </p>
        </div>
      </div>

      <div className="mb-8 inline-flex rounded-2xl border border-slate-200 bg-white/80 p-1.5 shadow-sm">
        <Link
          href="/feed"
          className={`px-6 py-2 rounded-xl font-semibold transition-all ${
            !isFollowingTab
              ? "bg-slate-950 text-white shadow-sm"
              : "text-slate-500 hover:text-slate-900"
          }`}
        >
          All Posts
        </Link>
        <Link
          href="/feed?tab=following"
          className={`px-6 py-2 rounded-xl font-semibold transition-all ${
            isFollowingTab
              ? "bg-slate-950 text-white shadow-sm"
              : "text-slate-500 hover:text-slate-900"
          }`}
        >
          Following
        </Link>
      </div>

      <div className="sb-surface-strong mb-10 p-6 md:p-7">
        <form action={createSocialPost} className="flex flex-col gap-4">
          <textarea
            name="content"
            placeholder="What are you researching today?"
            className="w-full resize-none border-none bg-transparent p-2 text-lg text-slate-800 outline-none placeholder:text-slate-400 focus:ring-0"
            rows={3}
            required
          />
          <div className="flex justify-end border-t border-slate-100 pt-4">
            <button type="submit" className="sb-button-accent">
              Post Update
            </button>
          </div>
        </form>
      </div>

      {/* Sleek Feed Items */}
      <div className="flex flex-col gap-6">
        {posts.map((post) => (
          <article key={post.id} className="sb-card sb-card-hover">
            {/* Header: Author Info */}
            <div className="flex items-center gap-4 mb-4">
              <Link href={`/scholar/${post.authorId}`} className="shrink-0">
                <div className="w-12 h-12 rounded-full bg-slate-100 border flex items-center justify-center overflow-hidden hover:ring-2 hover:ring-blue-100 transition">
                  {post.author.avatarUrl ? (
                    <Image
                      src={post.author.avatarUrl}
                      alt="Author"
                      width={48}
                      height={48}
                      unoptimized
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="font-semibold text-slate-400 text-lg">
                      {post.author.name?.charAt(0).toUpperCase() || "?"}
                    </span>
                  )}
                </div>
              </Link>
              <div>
                <Link
                  href={`/scholar/${post.authorId}`}
                  className="font-semibold text-slate-950 hover:text-blue-700 hover:underline transition"
                >
                  {post.author.name || "Scholar"}
                </Link>
                <div className="mt-0.5 text-xs font-medium text-slate-500">
                  {post.author.handle && (
                    <span className="mr-2">@{post.author.handle}</span>
                  )}
                  <span>{formatDate(post.createdAt)}</span>
                </div>
              </div>
            </div>

            {/* Body: Clickable Post Content */}
            <Link href={`/feed/${post.id}`} className="block group">
              <p className="mb-4 whitespace-pre-wrap leading-relaxed text-slate-800 transition-colors group-hover:text-slate-600">
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
                className="flex items-center gap-2 text-sm font-semibold text-slate-500 transition-colors hover:text-blue-700"
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
          <div className="rounded-[24px] border border-dashed border-slate-200 bg-white/80 py-12 text-center">
            <p className="font-medium text-slate-500">
              No posts to show right now.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
